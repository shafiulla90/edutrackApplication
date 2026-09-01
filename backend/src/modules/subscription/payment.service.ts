import { Injectable, BadRequestException, InternalServerErrorException, Logger, Inject } from '@nestjs/common';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { ISubscriptionRepository } from '../../common/interfaces/subscription.repository.interface';
import { IPlatformAdminRepository } from '../../common/interfaces/platform-admin.repository.interface';
import { ITenantRepository } from '../../common/interfaces/tenant.repository.interface';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @Inject('ISubscriptionRepository') private readonly subRepo: ISubscriptionRepository,
    @Inject('IPlatformAdminRepository') private readonly adminRepo: IPlatformAdminRepository,
    @Inject('ITenantRepository') private readonly tenantRepo: ITenantRepository,
  ) {}

  private async getRazorpayInstance() {
    const configs = await this.adminRepo.getGatewayConfigs();
    const config = configs.find((c) => c.gatewayName === 'RAZORPAY');

    const { decrypt } = require('../../common/utils/crypto.util');

    if (!config || !config.isActive) {
      throw new BadRequestException('Razorpay is not configured or not active');
    }

    const key_id = decrypt(config.keyId);
    const key_secret = decrypt(config.keySecret);

    if (!key_id || !key_secret) {
        throw new InternalServerErrorException('Razorpay credentials could not be decrypted');
    }

    return new (Razorpay as any)({
      key_id,
      key_secret,
    });
  }

  async createOrder(tenantId: string, planId: string) {
    const plan = await this.subRepo.findPlanById(planId);
    if (!plan) throw new BadRequestException('Plan not found');

    const amount = Number(plan.price);
    const gst = amount * 0.18;
    const total = amount + gst;

    const rzp = await this.getRazorpayInstance();

    const orderOptions = {
      amount: Math.round(total * 100),
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
    };

    let rzpOrder;
    try {
      rzpOrder = await rzp.orders.create(orderOptions);
    } catch (e) {
      this.logger.error('Failed to create Razorpay order', e);
      throw new InternalServerErrorException('Payment gateway error');
    }

    const subscriptionOrder = await this.subRepo.createOrder({
      id: rzpOrder.id,
      tenantId,
      planId,
      amount,
      gst,
      total,
      gateway: 'RAZORPAY',
      status: 'PENDING',
    });

    return {
      orderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      total,
      plan: plan.name,
    };
  }

  async verifyPaymentWebhook(signature: string, payload: any) {
    const configs = await this.adminRepo.getGatewayConfigs();
    const config = configs.find((c) => c.gatewayName === 'RAZORPAY');

    const { decrypt } = require('../../common/utils/crypto.util');
    const secret = decrypt(config?.webhookSecret || '');

    if (!secret) throw new BadRequestException('Webhook secret not found');

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (expectedSignature !== signature) {
      throw new BadRequestException('Invalid signature');
    }

    const event = payload.event;
    if (event === 'payment.captured') {
      const payment = payload.payload.payment.entity;
      await this.handleSuccessfulPayment(payment);
    }

    return { status: 'ok' };
  }

  private async handleSuccessfulPayment(payment: any) {
    const orderId = payment.order_id;
    const order = await this.subRepo.findOrderById(orderId);
    
    if (!order || order.status === 'PAID') return;

    await this.subRepo.createPayment({
      orderId,
      transactionId: payment.id,
      paymentId: payment.id,
      gateway: 'RAZORPAY',
      amount: order.amount,
      gst: order.gst,
      webhookResponse: payment,
      paymentStatus: 'SUCCESS',
      paidDate: new Date(),
    });

    const plan = await this.subRepo.findPlanById(order.planId);
    const tenant = await this.tenantRepo.findById(order.tenantId);

    const startDate = new Date();
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + (plan.duration || 6));

    await this.subRepo.createSubscription({
      tenantId: order.tenantId,
      planId: order.planId,
      startDate,
      expiryDate,
      status: 'ACTIVE',
      paymentReference: payment.id,
    });
  }
}
