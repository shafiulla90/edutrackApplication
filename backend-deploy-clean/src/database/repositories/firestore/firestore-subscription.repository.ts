import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase.service';
import { ISubscriptionRepository } from '../../../common/interfaces/subscription.repository.interface';
import { toCents, fromCents, formatDateISO } from '../../../common/utils/migration-helpers';

@Injectable()
export class FirestoreSubscriptionRepository implements ISubscriptionRepository {
  constructor(private readonly firebase: FirebaseService) {}

  private get db() {
    return this.firebase.getFirestore();
  }

  async findPlans(): Promise<any[]> {
    const snap = await this.db.collection('subscriptionPlans').where('status', '==', 'ACTIVE').get();
    return snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        price: data.priceCents !== undefined ? fromCents(data.priceCents) : Number(data.price || 0),
      };
    });
  }

  async findPlanById(id: string): Promise<any | null> {
    const doc = await this.db.collection('subscriptionPlans').doc(id).get();
    if (!doc.exists) return null;
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      price: data.priceCents !== undefined ? fromCents(data.priceCents) : Number(data.price || 0),
    };
  }

  async createOrder(data: any): Promise<any> {
    const ref = data.id ? this.db.collection('subscriptionOrders').doc(data.id) : this.db.collection('subscriptionOrders').doc();
    const payload = {
      ...data,
      id: ref.id,
      amountCents: toCents(data.amount),
      gstCents: toCents(data.gst),
      totalCents: toCents(data.total),
    };
    await ref.set(payload, { merge: true });
    return payload;
  }

  async findOrderById(id: string): Promise<any | null> {
    const doc = await this.db.collection('subscriptionOrders').doc(id).get();
    if (!doc.exists) return null;
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      amount: data.amountCents !== undefined ? fromCents(data.amountCents) : Number(data.amount || 0),
      gst: data.gstCents !== undefined ? fromCents(data.gstCents) : Number(data.gst || 0),
      total: data.totalCents !== undefined ? fromCents(data.totalCents) : Number(data.total || 0),
    };
  }

  async createPayment(data: any): Promise<any> {
    const ref = data.id ? this.db.collection('subscriptionPayments').doc(data.id) : this.db.collection('subscriptionPayments').doc();
    const payload = {
      ...data,
      id: ref.id,
      amountCents: toCents(data.amount),
      gstCents: toCents(data.gst),
      paidDate: formatDateISO(data.paidDate),
    };
    await ref.set(payload, { merge: true });
    return payload;
  }

  async createSubscription(data: any): Promise<any> {
    const ref = data.id ? this.db.collection('subscriptions').doc(data.id) : this.db.collection('subscriptions').doc();
    const payload = {
      ...data,
      id: ref.id,
      startDate: formatDateISO(data.startDate),
      expiryDate: formatDateISO(data.expiryDate),
    };
    await ref.set(payload, { merge: true });
    return payload;
  }

  async findActiveSubscription(tenantId: string): Promise<any | null> {
    const snap = await this.db.collection('subscriptions').where('tenantId', '==', tenantId).where('status', '==', 'ACTIVE').limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    const subData = { id: doc.id, ...doc.data() };
    const planDoc = await this.db.collection('subscriptionPlans').doc((subData as any).planId).get();
    return {
      ...subData,
      SubscriptionPlan: planDoc.exists ? { id: planDoc.id, ...planDoc.data() } : null,
    };
  }
}
