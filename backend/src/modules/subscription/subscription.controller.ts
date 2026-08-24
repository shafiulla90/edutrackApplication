import { Controller, Get, Post, Body, Req, Headers, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { PaymentService } from './payment.service';
import { getTenantIdFromReq } from '../../common/utils/tenant.util';

@ApiTags('SaaS Subscription Gateway')
@Controller()
export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly paymentService: PaymentService,
  ) {}

  @Get('subscription/config')
  @Get('api/subscription/config')
  @ApiOperation({ summary: 'Get SaaS Subscription Razorpay Gateway Config (Key ID only)' })
  async getSubscriptionConfig() {
    const config = await this.paymentService.getSaasGatewayConfig();
    return {
      enabled: config.enabled,
      environment: config.environment,
      keyId: config.keyId,
      isKeySecretSet: config.isKeySecretSet,
      isWebhookSecretSet: config.isWebhookSecretSet,
    };
  }

  @Get('subscription/plans')
  @Get('api/subscription/plans')
  @ApiOperation({ summary: 'Get available SaaS subscription plans' })
  async getPlans() {
    return this.subscriptionService.getAllPlans();
  }

  @Get('subscription/current')
  @Get('api/subscription/current')
  @Get('subscription/status')
  @Get('api/subscription/status')
  @ApiOperation({ summary: 'Get active tenant SaaS subscription status' })
  async getCurrent(@Req() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.subscriptionService.checkSubscriptionStatus(tenantId);
  }

  @Get('subscription/history')
  @Get('api/subscription/history')
  @ApiOperation({ summary: 'Get tenant SaaS subscription payment history' })
  async getHistory(@Req() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.subscriptionService.getPaymentHistory(tenantId);
  }

  @Get('subscription/invoices')
  @Get('api/subscription/invoices')
  @ApiOperation({ summary: 'Get tenant SaaS subscription invoices' })
  async getInvoices(@Req() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.subscriptionService.getInvoices(tenantId);
  }

  @Post('subscription/create-order')
  @Post('api/subscription/create-order')
  @Post('subscription/create')
  @Post('api/subscription/create')
  @ApiOperation({ summary: 'Create Razorpay subscription order (Server-enforced price)' })
  async createSubscriptionOrder(@Body() body: any, @Req() req: any) {
    const tenantId = getTenantIdFromReq(req);
    const planCode = body?.planCode || body?.planId || 'BASIC_12_MONTH';
    return this.paymentService.createSaasSubscriptionOrder(tenantId, planCode);
  }

  @Post('subscription/verify')
  @Post('api/subscription/verify')
  @ApiOperation({ summary: 'Verify Razorpay subscription payment signature' })
  async verifySubscriptionPayment(@Body() body: any, @Req() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.paymentService.verifySaasSubscriptionPayment(tenantId, body);
  }

  @Post([
    'subscription/webhook',
    'api/subscription/webhook',
    'api/v1/subscription/webhook',
    'api/v1/payments/subscription/webhook',
    'payment-gateway/razorpay/subscription/webhook',
  ])
  @ApiOperation({ summary: 'Razorpay SaaS subscription webhook listener' })
  async processSubscriptionWebhook(
    @Body() body: any,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
    return this.paymentService.processSaasSubscriptionWebhook(rawBody, signature);
  }
}
