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
        const tenantDoc = await this.db.collection('tenants').doc(tenantId).collection('subscription').doc('current').get();
        const rootDoc = await this.db.collection('subscriptions').doc(tenantId).get();

        const tenantData = tenantDoc.exists ? tenantDoc.data() : null;
        const rootData = rootDoc.exists ? rootDoc.data() : null;

        if (tenantData && rootData) {
          // Compare updatedAt or expiryDate to use the latest edited record
          const tenantExpiry = tenantData.expiryDate || '';
          const rootExpiry = rootData.expiryDate || '';

          if (rootExpiry !== tenantExpiry) {
            // Root document was edited in Firebase Console! Prefer root data & sync to tenant subcollection
            subData = rootData;
            await this.db.collection('tenants').doc(tenantId).collection('subscription').doc('current').set(rootData, { merge: true }).catch(() => null);
          } else {
            subData = tenantData;
          }
        } else {
          subData = tenantData || rootData;
        }
      } catch (err) {}
    }

    if (!subData) {
      // Default active subscription fallback for new/active tenants (6 months duration)
      const startDate = new Date();
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 6);
      subData = {
        tenantId,
        plan: 'BASIC',
        planCode: 'BASIC_6_MONTH',
        planName: 'EduTrack Basic – 6 Months',
        billingCycle: '6 Months',
        amount: 1,
        status: 'ACTIVE',
        startDate: startDate.toISOString(),
        expiryDate: expiryDate.toISOString(),
        gracePeriod: 14,
      };
    }

    const now = Date.now();
    const expDate = subData.expiryDate ? new Date(subData.expiryDate) : new Date(now + 180 * 24 * 60 * 60 * 1000);
    const expiryTime = expDate.getTime();
    const warningPeriodDays = 4; // 3-4 day warning window per prompt specification

    const msPerDay = 1000 * 60 * 60 * 24;
    const daysRemaining = Math.ceil((expiryTime - now) / msPerDay);

    let status: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' = 'ACTIVE';
    let isSubscriptionActive = true;

    if (now >= expiryTime) {
      status = 'EXPIRED';
      isSubscriptionActive = false;

      // Sync EXPIRED status back to Firestore if not already marked EXPIRED
      if (this.db && subData.status !== 'EXPIRED') {
        const expiredUpdate = { status: 'EXPIRED', updatedAt: new Date().toISOString() };
        this.db.collection('tenants').doc(tenantId).collection('subscription').doc('current').set(expiredUpdate, { merge: true }).catch(() => null);
        this.db.collection('subscriptions').doc(tenantId).set(expiredUpdate, { merge: true }).catch(() => null);
      }
    } else if (daysRemaining <= warningPeriodDays && daysRemaining > 0) {
      status = 'EXPIRING_SOON';
      isSubscriptionActive = true;
    } else {
      status = 'ACTIVE';
      isSubscriptionActive = true;
    }

    return {
      tenantId,
      plan: subData.plan || 'BASIC',
      planCode: subData.planCode || 'BASIC_6_MONTH',
      planName: subData.planName || 'EduTrack Basic – 6 Months',
      billingCycle: subData.billingCycle || '6 Months',
      amount: subData.amount || 1,
      status,
      storedStatus: subData.status || 'ACTIVE',
      startDate: subData.startDate,
      expiryDate: subData.expiryDate,
      daysRemaining: status === 'EXPIRED' ? 0 : Math.max(0, daysRemaining),
      rawDaysRemaining: daysRemaining,
      warningPeriodDays,
      isExpiringSoon: status === 'EXPIRING_SOON',
      isGracePeriod: false,
      isExpired: status === 'EXPIRED',
      isSubscriptionActive,
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
