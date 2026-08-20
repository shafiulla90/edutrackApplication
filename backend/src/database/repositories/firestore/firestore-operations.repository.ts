import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase.service';
import { IOperationsRepository } from '../../../common/interfaces/operations.repository.interface';
import { formatDateISO } from '../../../common/utils/migration-helpers';

@Injectable()
export class FirestoreOperationsRepository implements IOperationsRepository {
  constructor(private readonly firebase: FirebaseService) {}

  private get db() {
    return this.firebase.getFirestore();
  }

  async findComplaintsByTenant(tenantId: string): Promise<any[]> {
    const snap = await this.db.collection('tenants').doc(tenantId).collection('complaints').orderBy('createdAt', 'desc').get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async createComplaint(data: any): Promise<any> {
    if (!data.tenantId) throw new Error('tenantId is required');
    const tenantId = data.tenantId;
    const ref = data.id ? this.db.collection('tenants').doc(tenantId).collection('complaints').doc(data.id) : this.db.collection('tenants').doc(tenantId).collection('complaints').doc();
    const payload = {
      ...data,
      id: ref.id,
      tenantId,
      createdAt: formatDateISO(data.createdAt || new Date()),
    };
    await ref.set(payload, { merge: true });
    return payload;
  }

  async updateComplaint(id: string, data: any, tenantId?: string): Promise<any> {
    const tid = tenantId || data?.tenantId;
    if (tid) {
      const docRef = this.db.collection('tenants').doc(tid).collection('complaints').doc(id);
      await docRef.set(data, { merge: true });
      return { id, ...data };
    }
    const snap = await this.db.collectionGroup('complaints').where('id', '==', id).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    await doc.ref.set(data, { merge: true });
    return { id, ...doc.data(), ...data };
  }

  async findNotificationsByUser(recipientId: string): Promise<any[]> {
    const snap = await this.db.collection('notifications').where('recipientId', '==', recipientId).get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async createNotification(data: any): Promise<any> {
    const ref = data.id ? this.db.collection('notifications').doc(data.id) : this.db.collection('notifications').doc();
    const payload = {
      ...data,
      id: ref.id,
      createdAt: formatDateISO(data.createdAt || new Date()),
    };
    await ref.set(payload, { merge: true });
    return payload;
  }

  async markNotificationRead(id: string): Promise<any> {
    const ref = this.db.collection('notifications').doc(id);
    await ref.set({ isRead: true }, { merge: true });
    const doc = await ref.get();
    return { id: doc.id, ...doc.data() };
  }

  async logActivity(data: any): Promise<any> {
    if (!data.tenantId) throw new Error('tenantId is required');
    const tenantId = data.tenantId;
    const ref = data.id ? this.db.collection('tenants').doc(tenantId).collection('activityLogs').doc(data.id) : this.db.collection('tenants').doc(tenantId).collection('activityLogs').doc();
    const payload = {
      ...data,
      id: ref.id,
      tenantId,
      createdAt: formatDateISO(data.createdAt || new Date()),
    };
    await ref.set(payload, { merge: true });
    return payload;
  }
}
