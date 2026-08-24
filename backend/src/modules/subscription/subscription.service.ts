import { Injectable, Optional, Inject } from '@nestjs/common';
import { ISubscriptionRepository } from '../../common/interfaces/subscription.repository.interface';
import { FirebaseService } from '../../database/firebase.service';
import { SUBSCRIPTION_PLANS } from './payment.service';

@Injectable()
export class SubscriptionService {
  constructor(
    @Inject('ISubscriptionRepository') private readonly subRepo: ISubscriptionRepository,
    @Optional() private readonly firebaseService?: FirebaseService,
  ) {}

  private get db() {
    return this.firebaseService ? this.firebaseService.getFirestore() : null;
  }

  async assignFreePlanToNewTenant(tenantId: string) {
    const startDate = new Date();
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 6);

    const subscriptionData = {
      tenantId,
      plan: 'BASIC',
      planCode: 'BASIC_6_MONTH',
      planName: 'EduTrack Basic – 6 Months',
      amount: 1,
      billingCycle: '6 Months',
      durationMonths: 6,
      status: 'ACTIVE',
      startDate: startDate.toISOString(),
      expiryDate: expiryDate.toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (this.db) {
      await this.db.collection('tenants').doc(tenantId).collection('subscription').doc('current').set(subscriptionData, { merge: true }).catch(() => null);
      await this.db.collection('subscriptions').doc(tenantId).set(subscriptionData, { merge: true }).catch(() => null);
    }

    return subscriptionData;
  }

  async checkSubscriptionStatus(tenantId: string) {
    let subData: any = null;

    if (this.db && tenantId) {
      try {
        const doc = await this.db.collection('tenants').doc(tenantId).collection('subscription').doc('current').get();
        if (doc.exists) {
          subData = doc.data();
        } else {
          const rootDoc = await this.db.collection('subscriptions').doc(tenantId).get();
          if (rootDoc.exists) subData = rootDoc.data();
        }
      } catch (err) {}
    }

    if (!subData) {
      // Default active subscription fallback for new/active tenants
      const expiry = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();
      subData = {
        tenantId,
        plan: 'BASIC',
        planCode: 'BASIC_6_MONTH',
        planName: 'EduTrack Basic – 6 Months',
        billingCycle: '6 Months',
        amount: 1,
        status: 'ACTIVE',
        startDate: new Date().toISOString(),
        expiryDate: expiry,
      };
    }

    const expiryTime = new Date(subData.expiryDate || Date.now() + 180 * 24 * 60 * 60 * 1000).getTime();
    const daysRemaining = Math.max(0, Math.ceil((expiryTime - Date.now()) / (1000 * 60 * 60 * 24)));
    const isExpired = daysRemaining === 0 && subData.status !== 'ACTIVE';

    return {
      plan: subData.plan || 'BASIC',
      planCode: subData.planCode || 'BASIC_6_MONTH',
      planName: subData.planName || 'EduTrack Basic – 6 Months',
      billingCycle: subData.billingCycle || '6 Months',
      amount: subData.amount || 1,
      status: isExpired ? 'EXPIRED' : (subData.status || 'ACTIVE'),
      expiryDate: subData.expiryDate,
      daysRemaining,
      features: [
        'Unlimited Students & Staff Profiles',
        'Attendance, Fees & Timetable Management',
        'Exams, Grading & Progress Reports',
        'Parent Portal & In-App Notifications',
        'Transport & Bus GPS Tracking',
      ],
    };
  }

  async getAllPlans() {
    return Object.values(SUBSCRIPTION_PLANS).map((p) => ({
      id: p.code,
      code: p.code,
      name: p.name,
      amount: p.amount,
      price: p.amount,
      duration: `${p.months} Months`,
      months: p.months,
      currency: 'INR',
    }));
  }

  async getPaymentHistory(tenantId: string) {
    if (!this.db || !tenantId) return [];

    try {
      const snap = await this.db.collection('tenants').doc(tenantId).collection('subscriptionPayments').get();
      if (!snap.empty) {
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }

      const rootSnap = await this.db.collection('subscriptionPayments').where('tenantId', '==', tenantId).get();
      return rootSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      return [];
    }
  }

  async getInvoices(tenantId: string) {
    return this.getPaymentHistory(tenantId);
  }
}
