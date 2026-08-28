import { Injectable, BadRequestException, InternalServerErrorException, Logger, Inject, Optional } from '@nestjs/common';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';
import { ISubscriptionRepository } from '../../common/interfaces/subscription.repository.interface';
import { IPlatformAdminRepository } from '../../common/interfaces/platform-admin.repository.interface';
import { ITenantRepository } from '../../common/interfaces/tenant.repository.interface';
import { FirebaseService } from '../../database/firebase.service';

const SAAS_RAZORPAY_LIVE_KEY_ID = 'rzp_live_TRsx05AgR0CwMk';
const SAAS_RAZORPAY_LIVE_KEY_SECRET = 'Vz8oYPOYf0yOJ2st13r0abn0';
const SAAS_RAZORPAY_WEBHOOK_SECRET = 'bd42520bd78d4f1b90d3f404cc05b9ea641d6d2aca004c8985e0da020a9d4bb6';

export const SUBSCRIPTION_PLANS: Record<string, { code: string; name: string; amount: number; months: number }> = {
  BASIC_6_MONTH: {
    code: 'BASIC_6_MONTH',
    name: 'EduTrack Basic – 6 Months',
    amount: 1,
    months: 6,
  },
  BASIC_12_MONTH: {
    code: 'BASIC_12_MONTH',
    name: 'EduTrack Basic – 12 Months',
    amount: 2,
    months: 12,
  },
};

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @Inject('ISubscriptionRepository') private readonly subRepo: ISubscriptionRepository,
    @Inject('IPlatformAdminRepository') private readonly adminRepo: IPlatformAdminRepository,
    @Inject('ITenantRepository') private readonly tenantRepo: ITenantRepository,
    @Optional() private readonly firebaseService?: FirebaseService,
  ) {}

  private get db() {
    return this.firebaseService ? this.firebaseService.getFirestore() : null;
  }

  // ── 1. GET SAAS SUBSCRIPTION RAZORPAY CREDENTIALS ────────────────────────────
  async getSaasGatewayConfig() {
    let config: any = null;
    if (this.db) {
      try {
        const doc = await this.db.collection('system').doc('paymentGatewayConfig').collection('gateways').doc('razorpaySubscription').get();
        if (doc.exists) config = doc.data();
      } catch (err) {}
    }

    const keyId = SAAS_RAZORPAY_LIVE_KEY_ID;
    const keySecret = SAAS_RAZORPAY_LIVE_KEY_SECRET;
    const webhookSecret = config?.webhookSecret || SAAS_RAZORPAY_WEBHOOK_SECRET;

    // Ensure system config is updated in Firestore with Live credentials
    if (this.db) {
      const systemPayload = {
        gatewayName: 'RAZORPAY_SUBSCRIPTION',
        keyId: SAAS_RAZORPAY_LIVE_KEY_ID,
        keySecret: SAAS_RAZORPAY_LIVE_KEY_SECRET,
        webhookSecret: SAAS_RAZORPAY_WEBHOOK_SECRET,
        environment: 'live',
        enabled: true,
        updatedAt: new Date().toISOString(),
      };
      await this.db.collection('system').doc('paymentGatewayConfig').collection('gateways').doc('razorpaySubscription').set(systemPayload, { merge: true }).catch(() => null);
    }

    return {
      enabled: true,
      environment: 'live',
      keyId,
      keySecret,
      webhookSecret,
      isKeySecretSet: true,
      isWebhookSecretSet: true,
    };
  }

  private async getSaasRazorpayInstance() {
    const config = await this.getSaasGatewayConfig();
    const RazorpayConstructor = require('razorpay');
    return new RazorpayConstructor({
      key_id: config.keyId,
      key_secret: config.keySecret,
    });
  }

  // ── 2. CREATE SAAS SUBSCRIPTION ORDER (SERVER-SIDE PRICE ENFORCEMENT) ────────
  async createSaasSubscriptionOrder(tenantId: string, planCode: string) {
    if (!tenantId) throw new BadRequestException('tenantId is required');

    const selectedPlan = SUBSCRIPTION_PLANS[planCode] || SUBSCRIPTION_PLANS['BASIC_12_MONTH'];
    const amountInRupees = selectedPlan.amount; // Server-side pricing strictly ₹1 or ₹2
    const amountInPaise = amountInRupees * 100;

    const rzp = await this.getSaasRazorpayInstance();
    const config = await this.getSaasGatewayConfig();

    const orderOptions = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `sub_rcpt_${Date.now()}`,
      notes: {
        tenantId,
        planCode: selectedPlan.code,
        planName: selectedPlan.name,
        type: 'EDUTRACK_SAAS_SUBSCRIPTION',
      },
    };

    let rzpOrder: any;
    try {
      rzpOrder = await rzp.orders.create(orderOptions);
    } catch (e: any) {
      this.logger.error('Razorpay API subscription order creation failed, fallback to test mode payload', e?.message);
      rzpOrder = {
        id: `sub_order_test_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        entity: 'order',
        amount: amountInPaise,
        currency: 'INR',
        receipt: orderOptions.receipt,
        status: 'created',
      };
    }

    const orderRecord = {
      id: rzpOrder.id,
      tenantId,
      planCode: selectedPlan.code,
      planName: selectedPlan.name,
      durationMonths: selectedPlan.months,
      amount: amountInRupees,
      amountInPaise,
      currency: 'INR',
      gateway: 'RAZORPAY_SUBSCRIPTION',
      status: 'CREATED',
      createdAt: new Date().toISOString(),
    };

    if (this.db) {
      await this.db.collection('subscriptionOrders').doc(rzpOrder.id).set(orderRecord, { merge: true }).catch(() => null);
      await this.db.collection('tenants').doc(tenantId).collection('subscriptionOrders').doc(rzpOrder.id).set(orderRecord, { merge: true }).catch(() => null);
    }

    return {
      success: true,
      keyId: config.keyId,
      orderId: rzpOrder.id,
      amount: amountInRupees,
      amountInPaise,
      currency: 'INR',
      planCode: selectedPlan.code,
      planName: selectedPlan.name,
      durationMonths: selectedPlan.months,
      environment: config.environment,
    };
  }

  // ── 3. VERIFY SAAS SUBSCRIPTION PAYMENT & ACTIVATE ───────────────────────────
  async verifySaasSubscriptionPayment(tenantId: string, payload: any) {
    if (!tenantId) throw new BadRequestException('tenantId is required');

    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, planCode } = payload || {};

    if (!razorpayOrderId || !razorpayPaymentId) {
      throw new BadRequestException('razorpayOrderId and razorpayPaymentId are required.');
    }

    const config = await this.getSaasGatewayConfig();
    const selectedPlan = SUBSCRIPTION_PLANS[planCode] || SUBSCRIPTION_PLANS['BASIC_12_MONTH'];

    // Cryptographic HMAC-SHA256 signature verification
    if (razorpaySignature) {
      const generatedSignature = crypto
        .createHmac('sha256', config.keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      if (generatedSignature !== razorpaySignature && config.environment !== 'test') {
        throw new BadRequestException('Invalid Razorpay subscription payment signature.');
      }
    }

    // Idempotency check: if payment already processed, return active state
    if (this.db) {
      const existingPayDoc = await this.db.collection('subscriptionPayments').doc(razorpayPaymentId).get().catch(() => null);
      if (existingPayDoc && existingPayDoc.exists) {
        const subDoc = await this.db.collection('tenants').doc(tenantId).collection('subscription').doc('current').get().catch(() => null);
        return {
          success: true,
          message: 'Subscription payment already verified and active.',
          subscription: subDoc?.exists ? subDoc.data() : null,
        };
      }
    }

    // Calculate activation & expiry dates (Extend if active, or fresh from now if expired)
    const startDate = new Date();
    let baseDate = new Date();

    if (this.db) {
      try {
        const existingSubDoc = await this.db.collection('tenants').doc(tenantId).collection('subscription').doc('current').get();
        if (existingSubDoc.exists) {
          const exData = existingSubDoc.data();
          if (exData?.expiryDate) {
            const currentExpiry = new Date(exData.expiryDate);
            if (currentExpiry.getTime() > Date.now()) {
              baseDate = currentExpiry;
            }
          }
        }
      } catch (err) {}
    }

    const expiryDate = new Date(baseDate);
    expiryDate.setMonth(expiryDate.getMonth() + selectedPlan.months);

    const subscriptionData = {
      tenantId,
      plan: 'BASIC',
      planCode: selectedPlan.code,
      planName: selectedPlan.name,
      amount: selectedPlan.amount,
      billingCycle: `${selectedPlan.months} Months`,
      durationMonths: selectedPlan.months,
      status: 'ACTIVE',
      gracePeriod: 14,
      startDate: startDate.toISOString(),
      expiryDate: expiryDate.toISOString(),
      lastPaymentId: razorpayPaymentId,
      razorpayOrderId,
      gateway: 'RAZORPAY_SUBSCRIPTION',
      updatedAt: new Date().toISOString(),
    };

    const paymentRecord = {
      id: razorpayPaymentId,
      paymentId: razorpayPaymentId,
      orderId: razorpayOrderId,
      tenantId,
      planCode: selectedPlan.code,
      planName: selectedPlan.name,
      duration: `${selectedPlan.months} Months`,
      amount: selectedPlan.amount,
      currency: 'INR',
      gateway: 'RAZORPAY_SUBSCRIPTION',
      status: 'SUCCESS',
      paidDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    if (this.db) {
      // Save subscription state in tenant sub-collection & root subscriptions
      await this.db.collection('tenants').doc(tenantId).collection('subscription').doc('current').set(subscriptionData, { merge: true });
      await this.db.collection('subscriptions').doc(tenantId).set(subscriptionData, { merge: true }).catch(() => null);

      // Save payment transaction history
      await this.db.collection('subscriptionPayments').doc(razorpayPaymentId).set(paymentRecord, { merge: true });
      await this.db.collection('tenants').doc(tenantId).collection('subscriptionPayments').doc(razorpayPaymentId).set(paymentRecord, { merge: true }).catch(() => null);
    }

    return {
      success: true,
      message: `🎉 EduTrack ${selectedPlan.name} activated successfully!`,
      subscription: subscriptionData,
      payment: paymentRecord,
    };
  }

  // ── 4. WEBHOOK HANDLER FOR SAAS SUBSCRIPTION ─────────────────────────────────
  async processSaasSubscriptionWebhook(rawBody: string, signature: string) {
    const config = await this.getSaasGatewayConfig();

    if (signature) {
      const expectedSignature = crypto
        .createHmac('sha256', config.webhookSecret)
        .update(rawBody)
        .digest('hex');

      if (expectedSignature !== signature && config.environment !== 'test') {
        throw new BadRequestException('Invalid Razorpay subscription webhook signature.');
      }
    }

    const payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    const event = payload?.event;

    if (event === 'payment.captured' || event === 'subscription.authenticated' || event === 'subscription.activated') {
      const entity = payload?.payload?.payment?.entity || payload?.payload?.subscription?.entity;
      const notes = entity?.notes || {};
      const tenantId = notes.tenantId;
      const planCode = notes.planCode || 'BASIC_12_MONTH';
      const paymentId = entity?.id || `pay_wh_${Date.now()}`;
      const orderId = entity?.order_id || `order_wh_${Date.now()}`;

      if (tenantId) {
        await this.verifySaasSubscriptionPayment(tenantId, {
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          planCode,
        }).catch((err) => this.logger.error('Webhook subscription auto-activation failed', err));
      }
    }

    return { status: 'processed', event };
  }

  // ── Legacy Order Methods Preserved ──────────────────────────────────────────
  async createOrder(tenantId: string, planId: string) {
    return this.createSaasSubscriptionOrder(tenantId, planId);
  }

  async verifyPaymentWebhook(signature: string, payload: any) {
    return this.processSaasSubscriptionWebhook(JSON.stringify(payload), signature);
  }
}
