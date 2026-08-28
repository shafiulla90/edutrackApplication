import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase.service';
import { ITimetableRepository } from '../../../common/interfaces/timetable.repository.interface';

@Injectable()
export class FirestoreTimetableRepository implements ITimetableRepository {
  constructor(private readonly firebase: FirebaseService) {}

  private get db() {
    return this.firebase.getFirestore();
  }

  async findPeriodTimings(tenantId: string): Promise<any[]> {
    const snap = await this.db.collection('tenants').doc(tenantId).collection('periodTimings').orderBy('periodNumber', 'asc').get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async savePeriodTimingsTransaction(tenantId: string, timingsData: any[]): Promise<any> {
    const batch = this.db.batch();
    const snap = await this.db.collection('tenants').doc(tenantId).collection('periodTimings').get();
    snap.docs.forEach((doc) => batch.delete(doc.ref));

    timingsData.forEach((t) => {
      const ref = t.id ? this.db.collection('tenants').doc(tenantId).collection('periodTimings').doc(t.id) : this.db.collection('tenants').doc(tenantId).collection('periodTimings').doc();
      batch.set(ref, { ...t, id: ref.id, tenantId }, { merge: true });
    });

    await batch.commit();
    return { count: timingsData.length };
  }

  async findPeriodsByClassSection(classSectionId: string, tenantId?: string): Promise<any[]> {
    if (!tenantId) throw new Error('tenantId is required');
    const snap = await this.db.collection('tenants').doc(tenantId).collection('periods').where('classSectionId', '==', classSectionId).get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async findPeriodsByTeacher(teacherId: string, tenantId?: string): Promise<any[]> {
    if (!tenantId) throw new Error('tenantId is required');
    const snap = await this.db.collection('tenants').doc(tenantId).collection('periods').where('teacherId', '==', teacherId).get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async createPeriod(data: any): Promise<any> {
    if (!data.tenantId) throw new Error('tenantId is required');
    const tenantId = data.tenantId;
    const ref = data.id ? this.db.collection('tenants').doc(tenantId).collection('periods').doc(data.id) : this.db.collection('tenants').doc(tenantId).collection('periods').doc();
    const payload = { ...data, id: ref.id, tenantId };
    await ref.set(payload, { merge: true });
    return payload;
  }

  async updatePeriod(id: string, data: any, tenantId?: string): Promise<any> {
    const tid = tenantId || data?.tenantId;
    if (tid) {
      const docRef = this.db.collection('tenants').doc(tid).collection('periods').doc(id);
      await docRef.set(data, { merge: true });
      return { id, ...data };
    }
    const snap = await this.db.collectionGroup('periods').where('id', '==', id).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    await doc.ref.set(data, { merge: true });
    return { id, ...doc.data(), ...data };
  }

  async deletePeriod(id: string, tenantId?: string): Promise<any> {
    if (tenantId) {
      const docRef = this.db.collection('tenants').doc(tenantId).collection('periods').doc(id);
      const doc = await docRef.get();
      if (doc.exists) {
        const data = { id: doc.id, ...doc.data() };
        await docRef.delete();
        return data;
      }
    }
    const snap = await this.db.collectionGroup('periods').where('id', '==', id).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    const data = { id: doc.id, ...doc.data() };
    await doc.ref.delete();
    return data;
  }
}
