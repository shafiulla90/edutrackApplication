import { Controller, Get, Put, Post, Body, Query, Request, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PaymentGatewayService } from './payment-gateway.service';
import { getTenantIdFromReq } from '../../common/utils/tenant.util';

@ApiTags('Payment Gateway')
@Controller()
export class PaymentGatewayController {
  constructor(private readonly gatewayService: PaymentGatewayService) {}

  @Get('payment-gateway/razorpay/config')
  @ApiOperation({ summary: 'Get tenant Razorpay configuration (Masked)' })
  async getRazorpayConfig(@Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.gatewayService.getRazorpayConfig(tenantId);
  }

  @Put('payment-gateway/razorpay/config')
  @ApiOperation({ summary: 'Save tenant Razorpay configuration' })
  async saveRazorpayConfig(@Body() body: any, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.gatewayService.saveRazorpayConfig(tenantId, body || {});
  }

  @Post('payment-gateway/razorpay/disable')
  @ApiOperation({ summary: 'Disable tenant Razorpay gateway' })
  async disableRazorpayConfig(@Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.gatewayService.disableRazorpayConfig(tenantId);
  }

  @Post('payment-gateway/razorpay/test')
  @ApiOperation({ summary: 'Test tenant Razorpay connection credentials' })
  async testConnection(@Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.gatewayService.testConnection(tenantId);
  }

  @Post('payments/razorpay/create-order')
  @ApiOperation({ summary: 'Create Razorpay payment order server-side' })
  async createRazorpayOrder(@Body() body: any, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    const userId = req?.user?.id || req?.user?.sub || 'user';
    return this.gatewayService.createRazorpayOrder(tenantId, userId, body || {});
  }

  @Post('payments/razorpay/verify')
  @ApiOperation({ summary: 'Verify Razorpay cryptographic payment signature' })
  async verifyPaymentSignature(@Body() body: any, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.gatewayService.verifyPaymentSignature(tenantId, body || {});
  }

  @Post('payments/razorpay/webhook')
  @ApiOperation({ summary: 'Razorpay webhook listener' })
  async processWebhook(
    @Body() body: any,
    @Headers('x-razorpay-signature') signature: string,
    @Query('tenantId') queryTenantId?: string,
  ) {
    const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
    return this.gatewayService.processWebhook(rawBody, signature, queryTenantId);
  }

  @Post('payments/webhook')
  @ApiOperation({ summary: 'Razorpay webhook listener alias 1' })
  async processWebhookAlias1(
    @Body() body: any,
    @Headers('x-razorpay-signature') signature: string,
    @Query('tenantId') queryTenantId?: string,
  ) {
    const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
    return this.gatewayService.processWebhook(rawBody, signature, queryTenantId);
  }

  @Post('api/v1/payments/webhook')
  @ApiOperation({ summary: 'Razorpay webhook listener alias 2' })
  async processWebhookAlias2(
    @Body() body: any,
    @Headers('x-razorpay-signature') signature: string,
    @Query('tenantId') queryTenantId?: string,
  ) {
    const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
    return this.gatewayService.processWebhook(rawBody, signature, queryTenantId);
  }
}
