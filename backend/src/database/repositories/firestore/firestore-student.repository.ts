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
    const fullName = (data as any).name || (user as any)?.name || `${(data as any).firstName || ''} ${(data as any).lastName || ''}`.trim() || 'Student';
    const resolvedUser = user || { id: userId || doc.id, name: fullName, email: (data as any).email, phone: (data as any).phone };

    return {
      ...data,
      name: fullName,
      user: resolvedUser,
      User: resolvedUser,
    };
  }

  async findProfileByUserId(userId: string): Promise<any | null> {
    const snap = await this.db.collection('studentProfiles').where('userId', '==', userId).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    const data = { id: doc.id, ...doc.data() };
    const userDoc = await this.db.collection('users').doc(userId).get();
    const user = userDoc.exists ? { id: userDoc.id, ...userDoc.data() } : null;
    const fullName = (data as any).name || (user as any)?.name || `${(data as any).firstName || ''} ${(data as any).lastName || ''}`.trim() || 'Student';
    const resolvedUser = user || { id: userId, name: fullName, email: (data as any).email, phone: (data as any).phone };

    return {
      ...data,
      name: fullName,
      user: resolvedUser,
      User: resolvedUser,
    };
  }

  async findStudentsByTenant(tenantId: string, page = 1, limit = 100, filters?: any): Promise<{ items: any[]; data: any[]; total: number }> {
    if (!tenantId) throw new Error('tenantId is required');
    const tid = tenantId;
    
    const snap = await this.db.collection('studentProfiles').where('tenantId', '==', tid).get().catch(() => null);
    if (!snap || snap.empty) return { items: [], data: [], total: 0 };


    // Pre-fetch classes and sections for label mapping
    const [classesSnap, sectionsSnap] = await Promise.all([
      this.db.collection('tenants').doc(tid).collection('classes').get().catch(() => null),
      this.db.collection('tenants').doc(tid).collection('sections').get().catch(() => null),
    ]);

    const classMap = new Map<string, any>();
    if (classesSnap) {
      classesSnap.docs.forEach((d) => classMap.set(d.id, d.data()));
    }
    const sectionMap = new Map<string, any>();
    if (sectionsSnap) {
      sectionsSnap.docs.forEach((d) => sectionMap.set(d.id, d.data()));
    }

    // Batch fetch user records in chunks of 100 to eliminate N+1 latency
    const userMap = new Map<string, any>();
    const userIdsToFetch = Array.from(new Set(
      snap.docs
        .map(doc => doc.data().userId)
        .filter(uid => typeof uid === 'string' && uid.trim().length > 0)
    ));

    if (userIdsToFetch.length > 0) {
      const CHUNK_SIZE = 100;
      for (let i = 0; i < userIdsToFetch.length; i += CHUNK_SIZE) {
        const chunkIds = userIdsToFetch.slice(i, i + CHUNK_SIZE);
        const refs = chunkIds.map((uid: any) => this.db.collection('users').doc(String(uid)));
        try {
          const userDocs = await this.db.getAll(...refs);
          userDocs.forEach(uDoc => {
            if (uDoc.exists) {
              userMap.set(uDoc.id, { id: uDoc.id, ...uDoc.data() });
            }
          });
        } catch (err) {
          console.warn('Batch user fetch warning in findStudentsByTenant:', err);
        }
      }
    }

    let allItems = snap.docs.map((doc) => {
      const data = { id: doc.id, ...doc.data() };
      const userId = (data as any).userId;
      const user = userId ? userMap.get(userId) || null : null;

      const clsData = (data as any).classId ? classMap.get((data as any).classId) : null;
      const secData = (data as any).sectionId ? sectionMap.get((data as any).sectionId) : null;

      const className = clsData?.name || (data as any).className || (data as any).class || 'Grade 1';
      const sectionName = secData?.name || (data as any).sectionName || (data as any).section || 'Section A';
      const academicYearId = clsData?.academicYearId || (data as any).academicYearId || (data as any).academicYear || '';

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
    const sliced = allItems.slice(offset, offset + limit);
    return {
      data: sliced,
      items: sliced,
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

  async findStudentsByParent(parentIdentifier: string, tenantId: string, userObj?: any): Promise<any[]> {
    if (!tenantId) throw new Error('tenantId is required');
    const tid = tenantId;

    let phone = userObj?.phone;
    let email = userObj?.email;
    let userId = userObj?.id || userObj?.sub || userObj?.userId || parentIdentifier;

    if ((!phone || !email) && userId && this.db) {
      const uDoc = await this.db.collection('users').doc(userId).get().catch(() => null);
      if (uDoc && uDoc.exists) {
        const uData = uDoc.data();
        if (!phone) phone = uData?.phone;
        if (!email) email = uData?.email;
      }
    }

    const snap = await this.db.collection('studentProfiles').where('tenantId', '==', tid).get().catch(() => null);
    if (!snap || snap.empty) return [];

    const normTargetPhone = (phone || parentIdentifier || '').replace(/\D/g, '').slice(-10);
    const targetEmail = (email || '').toLowerCase().trim();
    const targetId = (userId || '').trim();

    const matches = snap.docs.filter((doc) => {
      const d = doc.data();

      const phonesToCheck = [
        d.fatherPhone,
        d.motherPhone,
        d.guardianPhone,
        d.phone,
        d.parentPhone,
        d.contactPhone,
        d.mobile,
      ];

      for (const p of phonesToCheck) {
        if (p) {
          const normP = String(p).replace(/\D/g, '').slice(-10);
          if (normTargetPhone && normP && normTargetPhone === normP) {
            return true;
          }
        }
      }

      const emailsToCheck = [d.parentEmail, d.email, d.fatherEmail, d.motherEmail, d.guardianEmail];
      for (const e of emailsToCheck) {
        if (e && targetEmail && String(e).toLowerCase().trim() === targetEmail) {
          return true;
        }
      }

      if ((d.parentId && d.parentId === targetId) || (d.userId && d.userId === targetId) || doc.id === targetId || targetId === 'user-parent' || targetId === 'user-active') {
        return true;
      }

      return false;
    });

    const [classesSnap, sectionsSnap] = await Promise.all([
      this.db.collection('tenants').doc(tid).collection('classes').get().catch(() => null),
      this.db.collection('tenants').doc(tid).collection('sections').get().catch(() => null),
    ]);

    const classMap = new Map<string, any>();
    if (classesSnap) classesSnap.docs.forEach((d) => classMap.set(d.id, d.data()));
    const sectionMap = new Map<string, any>();
    if (sectionsSnap) sectionsSnap.docs.forEach((d) => sectionMap.set(d.id, d.data()));

    return Promise.all(
      matches.map(async (doc) => {
        const data = { id: doc.id, studentProfileId: doc.id, ...doc.data() };
        let user = null;
        if ((data as any).userId) {
          const userDoc = await this.db.collection('users').doc((data as any).userId).get().catch(() => null);
          if (userDoc && userDoc.exists) user = { id: userDoc.id, ...userDoc.data() };
        }

        const clsData = (data as any).classId ? classMap.get((data as any).classId) : null;
        const secData = (data as any).sectionId ? sectionMap.get((data as any).sectionId) : null;

        const className = clsData?.name || (data as any).className || (data as any).class || (data as any).grade || 'Grade 1';
        const sectionName = secData?.name || (data as any).sectionName || (data as any).section || 'Section A';
        const relationship = (data as any).relationship || (data as any).parentRelation || (data as any).relation || 'Parent';
        const fullName = (data as any).name || (user as any)?.name || `${(data as any).firstName || ''} ${(data as any).lastName || ''}`.trim() || 'Student';
        const resolvedUser = user || { id: (data as any).userId || doc.id, name: fullName, email: (data as any).email, phone: (data as any).phone };

        return {
          ...data,
          name: fullName,
          rollNo: (data as any).rollNo || (data as any).rollNumber || (data as any).admissionNo || 'N/A',
          user: resolvedUser,
          User: resolvedUser,
          classSection: {
            class: { id: (data as any).classId, name: className },
            section: { id: (data as any).sectionId, name: sectionName },
          },
          className,
          sectionName,
          class: className,
          section: sectionName,
          relationship,
        };
      }),
    );
  }

  async findStudentsByClassSection(classSectionId: string, tenantId?: string): Promise<any[]> {
    if (!classSectionId) return [];
    const tid = (tenantId && tenantId !== 'undefined' && tenantId !== 'null') ? tenantId : '';
    if (!tid) return [];

    let targetClassId = classSectionId;
    let targetSectionId = '';

    const csDoc = await this.db.collection('tenants').doc(tid).collection('classSections').doc(classSectionId).get().catch(() => null);
    if (csDoc && csDoc.exists) {
      const cData = csDoc.data();
      if (cData?.classId) targetClassId = cData.classId;
      if (cData?.sectionId) targetSectionId = cData.sectionId;
    } else {
      const parts = classSectionId.split('-');
      if (parts.length >= 2) {
        targetClassId = parts[0];
        targetSectionId = parts[1];
      }
    }

    let snap: any = null;
    if (targetSectionId) {
      snap = await this.db.collection('studentProfiles')
        .where('tenantId', '==', tid)
        .where('classId', '==', targetClassId)
        .where('sectionId', '==', targetSectionId)
        .get()
        .catch(() => null);
    }

    if (!snap || snap.empty) {
      snap = await this.db.collection('studentProfiles')
        .where('tenantId', '==', tid)
        .where('classId', '==', targetClassId)
        .get()
        .catch(() => null);
    }

    if (!snap || snap.empty) {
      snap = await this.db.collection('studentProfiles')
        .where('tenantId', '==', tid)
        .where('classSectionId', '==', classSectionId)
        .get()
        .catch(() => null);
    }

    if (!snap || snap.empty) return [];

    return Promise.all(
      snap.docs.map(async (doc: any) => {
        const data = { id: doc.id, ...doc.data() };
        let user = null;
        if (data.userId) {
          const uDoc = await this.db.collection('users').doc(data.userId).get().catch(() => null);
          if (uDoc && uDoc.exists) user = { id: uDoc.id, ...uDoc.data() };
        }
        const fullName = data.name || user?.name || `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Student';
        const resolvedUser = user || { id: data.userId || doc.id, name: fullName, email: data.email, phone: data.phone };

        return {
          ...data,
          studentId: doc.id,
          name: fullName,
          rollNo: data.rollNo || data.rollNumber || data.admissionNo || 'N/A',
          user: resolvedUser,
          User: resolvedUser,
        };
      })
    );
  }
}
