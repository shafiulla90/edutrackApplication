import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase.service';
import { IAcademicRepository } from '../../../common/interfaces/academic.repository.interface';

function sanitizePayload(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizePayload);
  const clean: any = {};
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) {
      clean[key] = sanitizePayload(obj[key]);
    }
  }
  return clean;
}

@Injectable()
export class FirestoreAcademicRepository implements IAcademicRepository {
  constructor(private readonly firebase: FirebaseService) {}

  private get db() {
    return this.firebase.getFirestore();
  }

  async findAcademicYears(tenantId: string): Promise<any[]> {
    const tid = tenantId || 'tenant-test-001';
    const snap = await this.db.collection('tenants').doc(tid).collection('academicYears').get().catch(() => null);
    let docs = snap && !snap.empty ? snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) : [];
    if (docs.length === 0) {
      const rootSnap = await this.db.collection('academicYears').where('tenantId', '==', tid).get().catch(() => null);
      if (rootSnap && !rootSnap.empty) {
        docs = rootSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      }
    }
    return docs;
  }

  async findActiveAcademicYear(tenantId: string): Promise<any | null> {
    const snap = await this.db.collection('tenants').doc(tenantId).collection('academicYears').where('isActive', '==', true).limit(1).get();
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
  }

  async findClasses(tenantId: string, academicYearId?: string): Promise<any[]> {
    const tid = tenantId || 'tenant-test-001';
    let query: FirebaseFirestore.Query = this.db.collection('tenants').doc(tid).collection('classes');
    if (academicYearId) query = query.where('academicYearId', '==', academicYearId);
    const snap = await query.get().catch(() => null);
    
    let docs = snap && !snap.empty ? snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) : [];

    // Fallback: check root classes collection for matching tenantId
    if (docs.length === 0) {
      let rootQuery: FirebaseFirestore.Query = this.db.collection('classes').where('tenantId', '==', tid);
      if (academicYearId) rootQuery = rootQuery.where('academicYearId', '==', academicYearId);
      const rootSnap = await rootQuery.get().catch(() => null);
      if (rootSnap && !rootSnap.empty) {
        docs = rootSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
    }

    return docs;
  }

  async findClassById(id: string): Promise<any | null> {
    const snap = await this.db.collectionGroup('classes').where('id', '==', id).limit(1).get();
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
  }

  async createClass(data: any): Promise<any> {
    const tenantId = data.tenantId || 'tenant-test-001';
    const ref = data.id ? this.db.collection('tenants').doc(tenantId).collection('classes').doc(data.id) : this.db.collection('tenants').doc(tenantId).collection('classes').doc();
    const payload = sanitizePayload({ ...data, id: ref.id, tenantId });
    await ref.set(payload, { merge: true });
    return payload;
  }

  async deleteClass(id: string, tenantId: string = 'tenant-test-001'): Promise<any> {
    const docRef = this.db.collection('tenants').doc(tenantId).collection('classes').doc(id);
    const doc = await docRef.get();
    if (doc.exists) {
      const data = { id: doc.id, ...doc.data() };
      await docRef.delete();
      return data;
    }
    const snap = await this.db.collectionGroup('classes').get();
    const match = snap.docs.find((d) => d.id === id && (d.ref.path.includes(`tenants/${tenantId}/`) || d.data().tenantId === tenantId));
    if (match) {
      const data = { id: match.id, ...match.data() };
      await match.ref.delete();
      return data;
    }
    return null;
  }

  async findSections(tenantId: string): Promise<any[]> {
    const tid = tenantId || 'tenant-test-001';
    const snap = await this.db.collection('tenants').doc(tid).collection('sections').get().catch(() => null);
    let docs = snap && !snap.empty ? snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) : [];
    if (docs.length === 0) {
      const rootSnap = await this.db.collection('sections').where('tenantId', '==', tid).get().catch(() => null);
      if (rootSnap && !rootSnap.empty) {
        docs = rootSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      }
    }
    return docs;
  }

  async createSection(data: any): Promise<any> {
    const tenantId = data.tenantId || 'tenant-test-001';
    const ref = data.id ? this.db.collection('tenants').doc(tenantId).collection('sections').doc(data.id) : this.db.collection('tenants').doc(tenantId).collection('sections').doc();
    const payload = sanitizePayload({ ...data, id: ref.id, tenantId });
    await ref.set(payload, { merge: true });
    return payload;
  }

  async deleteSection(id: string, tenantId: string = 'tenant-test-001'): Promise<any> {
    const docRef = this.db.collection('tenants').doc(tenantId).collection('sections').doc(id);
    const doc = await docRef.get();
    if (doc.exists) {
      const data = { id: doc.id, ...doc.data() };
      await docRef.delete();
      return data;
    }
    const snap = await this.db.collectionGroup('sections').get();
    const match = snap.docs.find((d) => d.id === id && (d.ref.path.includes(`tenants/${tenantId}/`) || d.data().tenantId === tenantId));
    if (match) {
      const data = { id: match.id, ...match.data() };
      await match.ref.delete();
      return data;
    }
    return null;
  }

  async findClassSections(tenantId: string, classId?: string): Promise<any[]> {
    let query: FirebaseFirestore.Query = this.db.collection('tenants').doc(tenantId).collection('classSections');
    if (classId) query = query.where('classId', '==', classId);
    const snap = await query.get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async findSubjects(tenantId: string): Promise<any[]> {
    const tid = tenantId || 'tenant-test-001';
    const snap = await this.db.collection('tenants').doc(tid).collection('subjects').get().catch(() => null);
    let docs = snap && !snap.empty ? snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) : [];
    if (docs.length === 0) {
      const rootSnap = await this.db.collection('subjects').where('tenantId', '==', tid).get().catch(() => null);
      if (rootSnap && !rootSnap.empty) {
        docs = rootSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      }
    }
    return docs;
  }

  async createSubject(data: any): Promise<any> {
    const tenantId = data.tenantId || 'tenant-test-001';
    const ref = data.id ? this.db.collection('tenants').doc(tenantId).collection('subjects').doc(data.id) : this.db.collection('tenants').doc(tenantId).collection('subjects').doc();
    const payload = { ...data, id: ref.id, tenantId };
    await ref.set(payload, { merge: true });
    return payload;
  }

  async deleteSubject(id: string, tenantId: string = 'tenant-test-001'): Promise<any> {
    const docRef = this.db.collection('tenants').doc(tenantId).collection('subjects').doc(id);
    const doc = await docRef.get();
    if (doc.exists) {
      const data = { id: doc.id, ...doc.data() };
      await docRef.delete();
      return data;
    }
    const snap = await this.db.collectionGroup('subjects').get();
    const match = snap.docs.find((d) => d.id === id && (d.ref.path.includes(`tenants/${tenantId}/`) || d.data().tenantId === tenantId));
    if (match) {
      const data = { id: match.id, ...match.data() };
      await match.ref.delete();
      return data;
    }
    return null;
  }

  async createAcademicYear(data: any): Promise<any> {
    const tenantId = data.tenantId || 'tenant-test-001';
    const ref = data.id ? this.db.collection('tenants').doc(tenantId).collection('academicYears').doc(data.id) : this.db.collection('tenants').doc(tenantId).collection('academicYears').doc();
    const payload = {
      ...data,
      id: ref.id,
      tenantId,
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: new Date().toISOString(),
    };
    await ref.set(payload, { merge: true });
    return payload;
  }

  async toggleAcademicYearActive(id: string, tenantId: string): Promise<any> {
    const ref = this.db.collection('tenants').doc(tenantId).collection('academicYears').doc(id);
    const doc = await ref.get();
    const currentActive = doc.exists ? doc.data()?.isActive : false;
    await ref.set({ isActive: !currentActive, updatedAt: new Date().toISOString() }, { merge: true });
    const updated = await ref.get();
    return { id: updated.id, ...updated.data() };
  }

  async createClassSection(data: any): Promise<any> {
    const tenantId = data.tenantId || 'tenant-test-001';
    const ref = data.id ? this.db.collection('tenants').doc(tenantId).collection('classSections').doc(data.id) : this.db.collection('tenants').doc(tenantId).collection('classSections').doc();
    const payload = { ...data, id: ref.id, tenantId };
    await ref.set(payload, { merge: true });
    return payload;
  }
}
