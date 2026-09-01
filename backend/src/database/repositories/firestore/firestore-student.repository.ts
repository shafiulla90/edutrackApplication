import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase.service';
import { IStudentRepository } from '../../../common/interfaces/student.repository.interface';

function sanitizePayload(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj;
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
export class FirestoreStudentRepository implements IStudentRepository {
  constructor(private readonly firebase: FirebaseService) {}

  private get db() {
    return this.firebase.getFirestore();
  }

  async findProfileById(id: string): Promise<any | null> {
    const doc = await this.db.collection('studentProfiles').doc(id).get();
    if (!doc.exists) return null;
    const data = { id: doc.id, ...doc.data() };
    const userId = (data as any).userId;
    let user = null;
    if (userId) {
      const userDoc = await this.db.collection('users').doc(userId).get();
      if (userDoc.exists) {
        user = { id: userDoc.id, ...userDoc.data() };
      }
    }
    return {
      ...data,
      User: user,
    };
  }

  async findProfileByUserId(userId: string): Promise<any | null> {
    const snap = await this.db.collection('studentProfiles').where('userId', '==', userId).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  async findStudentsByClassSection(classSectionId: string): Promise<any[]> {
    const snap = await this.db.collection('studentProfiles').where('classSectionId', '==', classSectionId).get();
    if (snap.empty) return [];
    
    // Batch fetch associated users to avoid N+1 queries
    const userIds = snap.docs.map(d => d.data().userId).filter(Boolean);
    const userMap = new Map<string, any>();
    if (userIds.length > 0) {
      const userRefs = userIds.map(uid => this.db.collection('users').doc(uid));
      const userDocs = await this.db.getAll(...userRefs);
      userDocs.forEach(ud => {
        if (ud.exists) userMap.set(ud.id, { id: ud.id, ...ud.data() });
      });
    }

    return snap.docs.map((doc) => {
      const data = { id: doc.id, ...doc.data() };
      const user = userMap.get((data as any).userId) || null;
      return {
        ...data,
        User: user,
      };
    });
  }

  async findStudentsByTenant(tenantId: string, page = 1, limit = 100, filters?: any): Promise<{ items: any[]; total: number }> {
    const tid = tenantId || 'tenant-test-001';
    
    // Strict tenant isolation: fetch studentProfiles belonging strictly to tid
    const snap = await this.db.collection('studentProfiles').where('tenantId', '==', tid).get();
    
    if (snap.empty) {
      return { items: [], total: 0 };
    }

    // Pre-fetch classes, sections, and user documents in single batch requests
    const userIds = snap.docs.map(d => d.data().userId).filter(Boolean);

    const [classesSnap, sectionsSnap, userDocs] = await Promise.all([
      this.db.collection('tenants').doc(tid).collection('classes').get().catch(() => null),
      this.db.collection('tenants').doc(tid).collection('sections').get().catch(() => null),
      userIds.length > 0 ? this.db.getAll(...userIds.map(uid => this.db.collection('users').doc(uid))).catch(() => []) : Promise.resolve([]),
    ]);

    const classMap = new Map<string, any>();
    if (classesSnap) {
      classesSnap.docs.forEach((d) => classMap.set(d.id, d.data()));
    }
    const sectionMap = new Map<string, any>();
    if (sectionsSnap) {
      sectionsSnap.docs.forEach((d) => sectionMap.set(d.id, d.data()));
    }
    const userMap = new Map<string, any>();
    if (userDocs && Array.isArray(userDocs)) {
      userDocs.forEach((ud) => {
        if (ud.exists) userMap.set(ud.id, { id: ud.id, ...ud.data() });
      });
    }

    let allItems = snap.docs.map((doc) => {
      const data = { id: doc.id, ...doc.data() };
      const user = userMap.get((data as any).userId) || null;

      const clsData = (data as any).classId ? classMap.get((data as any).classId) : null;
      const secData = (data as any).sectionId ? sectionMap.get((data as any).sectionId) : null;

      const className = clsData?.name || (data as any).className || (data as any).class || 'Grade 1';
      const sectionName = secData?.name || (data as any).sectionName || (data as any).section || 'Section A';
      const academicYearId = (data as any).academicYearId || (data as any).academicYear || clsData?.academicYearId || '';

      const fullName = (data as any).name || (user as any)?.name || `${(data as any).firstName || ''} ${(data as any).lastName || ''}`.trim() || 'Student';

      return {
        ...data,
        name: fullName,
        rollNo: (data as any).rollNo || (data as any).rollNumber || (data as any).admissionNo || 'N/A',
        User: user || { id: (data as any).userId || doc.id, name: fullName, email: (data as any).email, phone: (data as any).phone },
        user: user || { id: (data as any).userId || doc.id, name: fullName, email: (data as any).email, phone: (data as any).phone },
        classSection: {
          class: { id: (data as any).classId, name: className, academicYearId },
          section: { id: (data as any).sectionId, name: sectionName },
        },
        className,
        sectionName,
        academicYearId,
      };
    });

    // Filter results if parameters provided
    if (filters) {
      if (filters.search && typeof filters.search === 'string' && filters.search.trim()) {
        const q = filters.search.toLowerCase().trim();
        allItems = allItems.filter((s: any) =>
          (s.name || '').toLowerCase().includes(q) ||
          (s.rollNo || '').toLowerCase().includes(q) ||
          (s.fatherName || '').toLowerCase().includes(q) ||
          (s.motherName || '').toLowerCase().includes(q) ||
          (s.aadharNo || '').toLowerCase().includes(q) ||
          (s.user?.phone || s.phone || s.parentPhone || '').includes(q) ||
          (s.user?.email || s.email || '').toLowerCase().includes(q)
        );
      }
      if (filters.classId && filters.classId !== 'All') {
        allItems = allItems.filter((s: any) => 
          s.classId === filters.classId || 
          s.className === filters.classId ||
          s.classSection?.class?.id === filters.classId ||
          s.classSection?.class?.name === filters.classId
        );
      }
      if (filters.sectionId && filters.sectionId !== 'All') {
        allItems = allItems.filter((s: any) => 
          s.sectionId === filters.sectionId || 
          s.sectionName === filters.sectionId ||
          s.classSection?.section?.id === filters.sectionId ||
          s.classSection?.section?.name === filters.sectionId
        );
      }
      if (filters.academicYearId && filters.academicYearId !== 'All') {
        allItems = allItems.filter((s: any) => 
          s.academicYearId === filters.academicYearId || 
          s.classSection?.class?.academicYearId === filters.academicYearId
        );
      }
    }

    const offset = (page - 1) * limit;
    return {
      items: allItems.slice(offset, offset + limit),
      total: allItems.length,
    };
  }

  async createProfile(data: any): Promise<any> {
    const ref = data.id ? this.db.collection('studentProfiles').doc(data.id) : this.db.collection('studentProfiles').doc();
    const payload = sanitizePayload({ ...data, id: ref.id });
    await ref.set(payload, { merge: true });
    return payload;
  }

  async updateProfile(id: string, data: any): Promise<any> {
    const ref = this.db.collection('studentProfiles').doc(id);
    const payload = sanitizePayload(data);
    await ref.set(payload, { merge: true });
    
    const doc = await ref.get();
    const studentData = { id: doc.id, ...doc.data() };
    const userId = (studentData as any).userId;

    if (userId) {
      const userUpdate: any = {};
      if (data.name) userUpdate.name = data.name;
      if (data.email) userUpdate.email = data.email;
      if (data.phone) userUpdate.phone = data.phone;
      if (data.status) userUpdate.isActive = data.status === 'Active';
      if (Object.keys(userUpdate).length > 0) {
        await this.db.collection('users').doc(userId).set(userUpdate, { merge: true }).catch(() => {});
      }
    }

    return studentData;
  }

  async deleteProfile(id: string): Promise<any> {
    const docRef = this.db.collection('studentProfiles').doc(id);
    const doc = await docRef.get();
    if (doc.exists) {
      const data = { id: doc.id, ...doc.data() };
      await docRef.delete();
      if ((data as any).userId) {
        await this.db.collection('users').doc((data as any).userId).delete().catch(() => {});
      }
      return data;
    }
    return { id, success: true };
  }

  async deleteBulkProfiles(studentIds: string[], tenantId: string): Promise<any> {
    const tid = tenantId || 'tenant-test-001';
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return { success: true, count: 0 };
    }

    let deletedCount = 0;
    // Chunk array in sizes of 200 to safely comply with Firestore batch limits
    const chunkSize = 200;
    for (let i = 0; i < studentIds.length; i += chunkSize) {
      const chunkIds = studentIds.slice(i, i + chunkSize);
      const batch = this.db.batch();
      let opsCount = 0;

      for (const id of chunkIds) {
        const docRef = this.db.collection('studentProfiles').doc(id);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          const d = docSnap.data();
          // STRICT TENANT GUARANTEE: Only delete if student belongs to tid
          if (d && d.tenantId === tid) {
            batch.delete(docRef);
            opsCount++;
            deletedCount++;
            if (d.userId) {
              const userRef = this.db.collection('users').doc(d.userId);
              batch.delete(userRef);
              opsCount++;
            }
          }
        }
      }

      if (opsCount > 0) {
        await batch.commit();
      }
    }

    return { success: true, count: deletedCount };
  }
}

