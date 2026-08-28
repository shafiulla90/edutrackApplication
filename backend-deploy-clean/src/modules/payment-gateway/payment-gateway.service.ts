import { Injectable, Inject, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
const Razorpay = require('razorpay');
import { IBillingRepository } from '../../common/interfaces/billing.repository.interface';
import { IStudentRepository } from '../../common/interfaces/student.repository.interface';

const ENCRYPTION_KEY = process.env.PAYMENT_ENCRYPTION_KEY || 'edutrack-secret-key-32-chars!!';
const ALGORITHM = 'aes-256-cbc';

function encryptSecret(text: string): string {
  if (!text) return '';
  const iv = crypto.randomBytes(16);
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function decryptSecret(encryptedText: string): string {
  if (!encryptedText) return '';
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) return encryptedText; // Fallback if plain
    const iv = Buffer.from(parts[0], 'hex');
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(parts[1], 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return encryptedText;
  }
}

@Injectable()
export class PaymentGatewayService {
  constructor(
    @Inject('IBillingRepository') private readonly billingRepo: IBillingRepository,
    @Inject('IStudentRepository') private readonly studentRepo: IStudentRepository,
  ) {}

  private get db(): any {
    return (this.studentRepo as any).db || (this.billingRepo as any).db;
  }

  // ── 1. CONFIGURATION MANAGEMENT ──────────────────────────────────────────────

  async getRazorpayConfig(tenantId: string): Promise<any> {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    const tid = tenantId || 'tenant-test-001';

    let configData: any = null;
    if (this.db) {
      try {
        const doc = await this.db.collection('tenants').doc(tid).collection('paymentGatewayConfig').doc('razorpay').get();
        if (doc && doc.exists) {
          configData = doc.data();
        }
      } catch (err) {}
    }

    if (!configData) {
      return {
        provider: 'razorpay',
        tenantId: tid,
        enabled: false,
        environment: 'test',
        keyId: '',
        isKeySecretSet: false,
        isWebhookSecretSet: false,
        supportedMethods: { upi: true, cards: true, netbanking: true, wallets: true },
        status: 'Not Configured',
      };
    }

    let status = 'Not Configured';
    if (configData.enabled) {
      status = configData.environment === 'live' ? 'Live Mode Configured' : 'Test Mode Configured';
    } else if (configData.keyId) {
      status = 'Disabled';
    }

    return {
      provider: 'razorpay',
      tenantId: tid,
      enabled: !!configData.enabled,
      environment: configData.environment || 'test',
      keyId: configData.keyId || '',
      isKeySecretSet: !!(configData.encryptedKeySecret || configData.keySecret),
      isWebhookSecretSet: !!(configData.encryptedWebhookSecret || configData.webhookSecret),
      supportedMethods: configData.supportedMethods || { upi: true, cards: true, netbanking: true, wallets: true },
      status,
      updatedAt: configData.updatedAt || new Date().toISOString(),
    };
  }

  async saveRazorpayConfig(tenantId: string, payload: any): Promise<any> {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    const tid = tenantId || 'tenant-test-001';

    // Retrieve existing config to keep old secrets if not updated
    const existing = await this.getRawConfigInternal(tid);

    const keyId = (payload.keyId !== undefined ? payload.keyId : existing.keyId || '').trim();
    let encryptedKeySecret = existing.encryptedKeySecret || '';
    if (payload.keySecret && payload.keySecret.trim() && !payload.keySecret.includes('••••')) {
      encryptedKeySecret = encryptSecret(payload.keySecret.trim());
    }

    let encryptedWebhookSecret = existing.encryptedWebhookSecret || '';
    if (payload.webhookSecret && payload.webhookSecret.trim() && !payload.webhookSecret.includes('••••')) {
      encryptedWebhookSecret = encryptSecret(payload.webhookSecret.trim());
    }

    const enabled = payload.enabled !== undefined ? !!payload.enabled : existing.enabled;
    const environment = payload.environment === 'live' ? 'live' : 'test';
    const supportedMethods = payload.supportedMethods || existing.supportedMethods || { upi: true, cards: true, netbanking: true, wallets: true };

    const updatedRecord = {
      provider: 'razorpay',
      tenantId: tid,
      enabled,
      environment,
      keyId,
      encryptedKeySecret,
      encryptedWebhookSecret,
      supportedMethods,
      updatedAt: new Date().toISOString(),
      createdAt: existing.createdAt || new Date().toISOString(),
    };

    if (this.db) {
      await this.db.collection('tenants').doc(tid).collection('paymentGatewayConfig').doc('razorpay').set(updatedRecord, { merge: true });
      await this.db.collection('paymentGatewayConfigs').doc(`${tid}_razorpay`).set(updatedRecord, { merge: true }).catch(() => null);
    }

    return this.getRazorpayConfig(tid);
  }

  async disableRazorpayConfig(tenantId: string): Promise<any> {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    const tid = tenantId || 'tenant-test-001';

    if (this.db) {
      await this.db.collection('tenants').doc(tid).collection('paymentGatewayConfig').doc('razorpay').set({
        enabled: false,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }

    return this.getRazorpayConfig(tid);
  }

  // ── 2. CONNECTION TEST ────────────────────────────────────────────────────────

  async testConnection(tenantId: string): Promise<{ success: boolean; message: string }> {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    const tid = tenantId || 'tenant-test-001';

    const rawConfig = await this.getRawConfigInternal(tid);
    if (!rawConfig.keyId || !rawConfig.keySecret) {
      return {
        success: false,
        message: 'Unable to connect to Razorpay. Missing Key ID or Key Secret credentials.',
      };
    }

    try {
      const razorpay = new Razorpay({
        key_id: rawConfig.keyId,
        key_secret: rawConfig.keySecret,
      });

      // Safe test query
      await razorpay.orders.all({ count: 1 });
      return {
        success: true,
        message: `✓ Razorpay connection successful (${rawConfig.environment.toUpperCase()} Mode).`,
      };
    } catch (err: any) {
      console.error('Razorpay test connection failed:', err?.error?.description || err.message);
      return {
        success: false,
        message: 'Unable to connect to Razorpay. Please verify your Key ID and Key Secret credentials.',
      };
    }
  }

  // ── 3. REAL RAZORPAY ORDER CREATION ──────────────────────────────────────────

  async createRazorpayOrder(tenantId: string, userId: string, payload: any): Promise<any> {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    const tid = tenantId || 'tenant-test-001';
    const { studentId, invoiceId, itemAmounts, requestedAmount } = payload || {};

    if (!invoiceId || !studentId) {
      throw new BadRequestException('studentId and invoiceId are required');
    }

    // 1. Fetch & validate tenant's Razorpay configuration
    const rawConfig = await this.getRawConfigInternal(tid);
    if (!rawConfig.enabled) {
      throw new BadRequestException('Razorpay payment gateway is currently disabled for this school.');
    }
    if (!rawConfig.keyId || !rawConfig.keySecret) {
      throw new BadRequestException('Razorpay credentials are not fully configured for this school.');
    }

    // 2. Fetch & validate invoice & student from Firestore
    let invoice: any = null;
    let student: any = null;

    if (this.db) {
      try {
        const invDoc = await this.db.collection('tenants').doc(tid).collection('invoices').doc(invoiceId).get();
        if (invDoc && invDoc.exists) {
          invoice = invDoc.data();
        } else {
          const rootInv = await this.db.collection('invoices').doc(invoiceId).get();
          if (rootInv && rootInv.exists) {
            invoice = rootInv.data();
          } else {
            // Search tenant invoices collection by studentId
            const studentInvoices = await this.db.collection('tenants').doc(tid).collection('invoices')
              .where('studentId', '==', studentId)
              .get();
            if (studentInvoices && !studentInvoices.empty) {
              const openDoc = studentInvoices.docs.find(d => d.data().status !== 'PAID');
              if (openDoc) {
                invoice = openDoc.data();
              } else {
                invoice = studentInvoices.docs[0].data();
              }
            }
          }
        }
      } catch (err) {}

      try {
        const sDoc = await this.db.collection('studentProfiles').doc(studentId).get();
        if (sDoc && sDoc.exists) student = sDoc.data();
      } catch (err) {}
    }

    // Dynamic invoice fallback for on-the-fly fee collection in Admin Billing
    if (!invoice) {
      invoice = {
        id: invoiceId,
        invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
        studentId: studentId,
        totalAmount: requestedAmount || 15000,
        paidAmount: 0,
        remainingBalance: requestedAmount || 15000,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      };
    }

    // Validate tenant & student match
    if (invoice.studentId && invoice.studentId !== studentId) {
      throw new UnauthorizedException('Invoice does not belong to the specified student.');
    }

    if (invoice.status === 'PAID') {
      throw new BadRequestException('This invoice has already been fully paid.');
    }

    // 3. SERVER-SIDE PAYABLE AMOUNT CALCULATION
    const remainingBalance = Number(invoice.remainingBalance ?? invoice.balanceDue ?? ((invoice.totalAmount || 0) - (invoice.paidAmount || 0)));
    if (remainingBalance <= 0) {
      throw new BadRequestException('This invoice has zero remaining balance due.');
    }

    let payableAmount = remainingBalance;
    if (Array.isArray(itemAmounts) && itemAmounts.length > 0) {
      let selectedSum = 0;
      itemAmounts.forEach((item: any) => {
        const amt = Number(item.amount || item.price || 0);
        if (amt > 0) selectedSum += amt;
      });
      if (selectedSum > 0 && selectedSum <= remainingBalance) {
        payableAmount = selectedSum;
      }
    } else if (requestedAmount && Number(requestedAmount) > 0 && Number(requestedAmount) <= remainingBalance) {
      payableAmount = Number(requestedAmount);
    }

    // 4. Create Razorpay Order server-side (Amount in paise)
    const amountInPaise = Math.round(payableAmount * 100);
    const razorpay = new Razorpay({
      key_id: rawConfig.keyId,
      key_secret: rawConfig.keySecret,
    });

    const receiptNo = (invoice.invoiceNumber || invoiceId).slice(0, 40);
    const orderOptions = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: receiptNo,
      notes: {
        tenantId: tid,
        studentId,
        invoiceId,
        environment: rawConfig.environment,
      },
    };

    let razorpayOrder: any = null;
    try {
      razorpayOrder = await razorpay.orders.create(orderOptions);
    } catch (err: any) {
      console.error('Razorpay API order creation failed:', err?.error?.description || err.message);
      // Sandbox fallback for local development testing when demo keys are used
      if (rawConfig.environment === 'test' && (err?.statusCode === 401 || err?.error?.code === 'BAD_REQUEST_ERROR')) {
        razorpayOrder = {
          id: `order_test_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          entity: 'order',
          amount: amountInPaise,
          amount_paid: 0,
          amount_due: amountInPaise,
          currency: 'INR',
          receipt: receiptNo,
          status: 'created',
          attempts: 0,
          notes: orderOptions.notes,
          created_at: Math.floor(Date.now() / 1000),
        };
      } else {
        throw new BadRequestException(`Razorpay order creation failed: ${err?.error?.description || err.message}`);
      }
    }

    // 5. Store Payment Transaction Record in Firestore
    const txId = `tx-rzp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const studentName = student?.name || student?.fullName || invoice.studentName || 'Student';
    const schoolName = 'EduTrack SaaS School';

    const paymentTx = {
      id: txId,
      tenantId: tid,
      studentId,
      parentId: userId || 'parent-user',
      invoiceId,
      razorpayOrderId: razorpayOrder.id,
      razorpayPaymentId: '',
      razorpaySignature: '',
      amount: payableAmount,
      amountInPaise,
      currency: 'INR',
      status: 'CREATED',
      paymentMethod: 'RAZORPAY',
      environment: rawConfig.environment,
      itemAmounts: itemAmounts || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (this.db) {
      await this.db.collection('tenants').doc(tid).collection('paymentTransactions').doc(txId).set(paymentTx, { merge: true });
      await this.db.collection('paymentTransactions').doc(txId).set(paymentTx, { merge: true }).catch(() => null);
    }

    // 6. Return safe checkout payload (Key Secret is NEVER returned)
    return {
      success: true,
      keyId: rawConfig.keyId,
      orderId: razorpayOrder.id,
      amount: payableAmount,
      amountInPaise,
      currency: 'INR',
      studentName,
      schoolName,
      invoiceNumber: invoice.invoiceNumber || invoice.id,
      transactionId: txId,
      environment: rawConfig.environment,
    };
  }

  // ── 4. SERVER-SIDE SIGNATURE VERIFICATION & INVOICE UPDATE ─────────────────────

  async verifyPaymentSignature(tenantId: string, payload: any): Promise<any> {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    const tid = tenantId || 'tenant-test-001';
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, invoiceId, studentId, transactionId } = payload || {};

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      throw new BadRequestException('razorpayOrderId, razorpayPaymentId, and razorpaySignature are required');
    }

    // 1. Fetch tenant config & decrypt secret
    const rawConfig = await this.getRawConfigInternal(tid);
    if (!rawConfig.keySecret) {
      throw new BadRequestException('Razorpay credentials not found for this tenant');
    }

    // 2. CRYPTOGRAPHIC SIGNATURE VERIFICATION
    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', rawConfig.keySecret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      // Mark transaction as FAILED
      if (this.db && transactionId) {
        await this.db.collection('tenants').doc(tid).collection('paymentTransactions').doc(transactionId).set({
          status: 'FAILED',
          razorpayPaymentId,
          razorpaySignature,
          failureReason: 'Cryptographic signature verification failed',
          updatedAt: new Date().toISOString(),
        }, { merge: true }).catch(() => null);
      }
      throw new BadRequestException('Razorpay payment signature verification failed. Payment blocked.');
    }

    // 3. IDEMPOTENCY CHECK
    let txData: any = null;
    if (this.db && transactionId) {
      const txDoc = await this.db.collection('tenants').doc(tid).collection('paymentTransactions').doc(transactionId).get().catch(() => null);
      if (txDoc && txDoc.exists) txData = txDoc.data();
    }

    if (txData && txData.status === 'CAPTURED') {
      return {
        success: true,
        message: 'Payment already processed and captured.',
        alreadyCaptured: true,
        transactionId: txData.id,
      };
    }

    const paidAmount = Number(txData?.amount || payload.amount || 0);

    // 4. UPDATE INVOICE & STUDENT LEDGER IN FIRESTORE
    let invoiceData: any = null;
    let effectiveInvoiceId = invoiceId || txData?.invoiceId;
    let effectiveStudentId = studentId || txData?.studentId;

    if (this.db && effectiveInvoiceId) {
      const invDoc = await this.db.collection('tenants').doc(tid).collection('invoices').doc(effectiveInvoiceId).get().catch(() => null);
      if (invDoc && invDoc.exists) {
        invoiceData = invDoc.data();
      }
    }

    const currentPaid = Number(invoiceData?.paidAmount || 0);
    const totalAmt = Number(invoiceData?.totalAmount || paidAmount);
    const newPaidAmount = currentPaid + paidAmount;
    const newRemainingBalance = Math.max(0, totalAmt - newPaidAmount);
    const newInvoiceStatus = newRemainingBalance <= 0 ? 'PAID' : 'PARTIALLY_PAID';

    // Update Invoice Document
    if (this.db && effectiveInvoiceId) {
      const invUpdate = {
        paidAmount: newPaidAmount,
        remainingBalance: newRemainingBalance,
        balanceDue: newRemainingBalance,
        status: newInvoiceStatus,
        lastPaymentDate: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await this.db.collection('tenants').doc(tid).collection('invoices').doc(effectiveInvoiceId).set(invUpdate, { merge: true }).catch(() => null);
      await this.db.collection('invoices').doc(effectiveInvoiceId).set(invUpdate, { merge: true }).catch(() => null);
    }

    // Update Student Profile Ledger
    if (this.db && effectiveStudentId) {
      try {
        const sDoc = await this.db.collection('studentProfiles').doc(effectiveStudentId).get().catch(() => null);
        if (sDoc && sDoc.exists) {
          const sd = sDoc.data();
          const currBal = Number(sd.balanceDue ?? sd.totalPendingBalance ?? 0);
          const newBal = Math.max(0, currBal - paidAmount);
          await this.db.collection('studentProfiles').doc(effectiveStudentId).set({
            balanceDue: newBal,
            totalPendingBalance: newBal,
            paidAmount: Number(sd.paidAmount || 0) + paidAmount,
            financialStatus: newBal <= 0 ? 'PAID' : 'PARTIALLY_PAID',
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        }
      } catch (e) {}
    }

    // Record Payment Receipt Document
    const paymentReceiptId = `pay-rzp-${Date.now()}`;
    const paymentReceipt = {
      id: paymentReceiptId,
      receiptNumber: `RCP-RZP-${Date.now().toString().slice(-6)}`,
      tenantId: tid,
      studentId: effectiveStudentId,
      invoiceId: effectiveInvoiceId,
      amount: paidAmount,
      currency: 'INR',
      paymentMethod: 'RAZORPAY',
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      status: 'CAPTURED',
      environment: rawConfig.environment,
      paymentDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    if (this.db) {
      await this.db.collection('tenants').doc(tid).collection('payments').doc(paymentReceiptId).set(paymentReceipt, { merge: true }).catch(() => null);
      await this.db.collection('payments').doc(paymentReceiptId).set(paymentReceipt, { merge: true }).catch(() => null);

      // Update Transaction Record
      if (transactionId) {
        await this.db.collection('tenants').doc(tid).collection('paymentTransactions').doc(transactionId).set({
          status: 'CAPTURED',
          razorpayPaymentId,
          razorpaySignature,
          paymentReceiptId,
          updatedAt: new Date().toISOString(),
        }, { merge: true }).catch(() => null);
      }
    }

    return {
      success: true,
      message: 'Payment verified and captured successfully!',
      paymentReceiptId,
      paidAmount,
      remainingBalance: newRemainingBalance,
      invoiceStatus: newInvoiceStatus,
      razorpayPaymentId,
    };
  }

  // ── 5. WEBHOOK PROCESSING (IDEMPOTENT) ────────────────────────────────────────

  async processWebhook(rawBody: string, signature: string, queryTenantId?: string): Promise<any> {
    if (!signature) throw new BadRequestException('x-razorpay-signature header missing');

    let payload: any = null;
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      throw new BadRequestException('Invalid webhook JSON body');
    }

    const entity = payload?.payload?.payment?.entity || payload?.payload?.order?.entity;
    const tid = entity?.notes?.tenantId || queryTenantId || 'tenant-test-001';

    // Verify webhook signature against tenant secret
    const rawConfig = await this.getRawConfigInternal(tid);
    if (rawConfig.webhookSecret) {
      const expectedSig = crypto
        .createHmac('sha256', rawConfig.webhookSecret)
        .update(rawBody)
        .digest('hex');

      if (expectedSig !== signature) {
        throw new BadRequestException('Webhook signature mismatch');
      }
    }

    const eventName = payload.event;
    const razorpayOrderId = entity?.order_id || entity?.id;
    const razorpayPaymentId = entity?.id;
    const invoiceId = entity?.notes?.invoiceId;
    const studentId = entity?.notes?.studentId;

    console.log(`Received Razorpay Webhook Event [${eventName}] for tenant [${tid}]`);

    if (eventName === 'payment.captured' || eventName === 'order.paid') {
      const amount = Number(entity.amount || 0) / 100;
      await this.verifyPaymentSignature(tid, {
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature: signature,
        invoiceId,
        studentId,
        amount,
      }).catch((err) => console.log('Webhook verification handled:', err.message));
    }

    return { status: 'processed', event: eventName };
  }

  // ── HELPER INTERNAL METHOD ──────────────────────────────────────────────────

  private async getRawConfigInternal(tid: string): Promise<any> {
    if (!this.db) return { keyId: '', keySecret: '', webhookSecret: '', enabled: false, environment: 'test' };

    try {
      const doc = await this.db.collection('tenants').doc(tid).collection('paymentGatewayConfig').doc('razorpay').get();
      if (doc && doc.exists) {
        const data = doc.data();
        return {
          ...data,
          keySecret: decryptSecret(data.encryptedKeySecret || data.keySecret || ''),
          webhookSecret: decryptSecret(data.encryptedWebhookSecret || data.webhookSecret || ''),
        };
      }
    } catch (err) {}

    return { keyId: '', keySecret: '', webhookSecret: '', enabled: false, environment: 'test' };
  }
}
