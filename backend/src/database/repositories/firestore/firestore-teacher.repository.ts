import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase.service';
import { ITeacherRepository } from '../../../common/interfaces/teacher.repository.interface';
import { DeterministicKey } from '../../../common/utils/migration-helpers';

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
export class FirestoreTeacherRepository implements ITeacherRepository {
  constructor(private readonly firebase: FirebaseService) {}

  private get db() {
    return this.firebase.getFirestore();
  }

  async findProfileById(id: string): Promise<any | null> {
    const doc = await this.db.collection('staffProfiles').doc(id).get();
    if (!doc.exists) return null;
    const data = { id: doc.id, ...doc.data() };
    const userDoc = await this.db.collection('users').doc((data as any).userId).get();
    const userData = userDoc.exists ? { id: userDoc.id, ...userDoc.data() } : null;
    return {
      ...data,
      User: userData,
      user: userData,
    };
  }

  async findProfileByUserId(userId: string): Promise<any | null> {
    const snap = await this.db.collection('staffProfiles').where('userId', '==', userId).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  async findTeachersByTenant(tenantId: string): Promise<any[]> {
    // Query users with role TEACHER or STAFF (non-teaching) for this tenant
    const [teacherSnap, staffSnap, driverSnap] = await Promise.all([
      this.db.collection('users').where('tenantId', '==', tenantId).where('role', '==', 'TEACHER').get(),
      this.db.collection('users').where('tenantId', '==', tenantId).where('role', '==', 'STAFF').get(),
      this.db.collection('users').where('tenantId', '==', tenantId).where('role', '==', 'DRIVER').get(),
    ]);

    const allUserDocs = [...teacherSnap.docs, ...staffSnap.docs, ...driverSnap.docs];
    const userIds = allUserDocs.map((d) => d.id);
    if (userIds.length === 0) return [];

    // Firestore 'in' query supports max 30 items
    const staffProfiles: any[] = [];
    for (let i = 0; i < userIds.length; i += 30) {
      const batch = userIds.slice(i, i + 30);
      const snap = await this.db.collection('staffProfiles').where('userId', 'in', batch).get();
      staffProfiles.push(...snap.docs);
    }

    const userMap = new Map<string, any>();
    allUserDocs.forEach((d) => {
      userMap.set(d.id, { id: d.id, ...d.data() });
    });

    return staffProfiles.map((doc) => {
      const data = { id: doc.id, ...doc.data() };
      const userData = (data as any).userId ? userMap.get((data as any).userId) : null;
      const name = (userData as any)?.name || (data as any).name || 'Teacher Profile';
      const email = (userData as any)?.email || (data as any).email || 'N/A';
      const phone = (userData as any)?.phone || (data as any).phone || 'N/A';
      const role = (userData as any)?.role || (data as any).role || 'TEACHER';

      return {
        ...data,
        name,
        email,
        phone,
        role,
        User: userData || { id: (data as any).userId || doc.id, name, email, phone, role },
        user: userData || { id: (data as any).userId || doc.id, name, email, phone, role },
      };
    });
  }


  async findTeacherAssignments(teacherId: string, tenantId?: string): Promise<any[]> {
    const tid = (tenantId && tenantId !== 'undefined' && tenantId !== 'null') ? tenantId : '';
    if (!tid) return [];
    let assignments: any[] = [];

    if (tid) {
      const classSectionsSnap = await this.db.collection('tenants').doc(tid).collection('classSections').where('teacherId', '==', teacherId).get().catch(() => null);
      if (classSectionsSnap && !classSectionsSnap.empty) {
        classSectionsSnap.docs.forEach((doc) => {
          assignments.push({ id: doc.id, classSectionId: doc.id, ...doc.data() });
        });
      }

      const tenantAssignSnap = await this.db.collection('tenants').doc(tid).collection('teacherAssignments').where('teacherId', '==', teacherId).get().catch(() => null);
      if (tenantAssignSnap && !tenantAssignSnap.empty) {
        tenantAssignSnap.docs.forEach((doc) => {
          const data = doc.data();
          if (!assignments.some((a) => a.id === doc.id || a.classSectionId === data.classSectionId)) {
            assignments.push({ id: doc.id, ...data });
          }
        });
      }

      if (assignments.length === 0) {
        const allCsSnap = await this.db.collection('tenants').doc(tid).collection('classSections').get().catch(() => null);
        if (allCsSnap && !allCsSnap.empty) {
          allCsSnap.docs.forEach((doc) => {
            assignments.push({ id: doc.id, classSectionId: doc.id, ...doc.data() });
          });
        }
      }
    } else {
      const snap = await this.db.collectionGroup('teacherAssignments').where('teacherId', '==', teacherId).get();
      assignments = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    }

    if (tid && assignments.length > 0) {
      const [classesSnap, sectionsSnap] = await Promise.all([
        this.db.collection('tenants').doc(tid).collection('classes').get().catch(() => null),
        this.db.collection('tenants').doc(tid).collection('sections').get().catch(() => null),
      ]);

      const classMap = new Map<string, any>();
      if (classesSnap) classesSnap.docs.forEach((d) => classMap.set(d.id, d.data()));
      const sectionMap = new Map<string, any>();
      if (sectionsSnap) sectionsSnap.docs.forEach((d) => sectionMap.set(d.id, d.data()));

      const resolvedList = await Promise.all(
        assignments.map(async (assign) => {
          const classId = assign.classId;
          const sectionId = assign.sectionId;
          const clsData = classId ? classMap.get(classId) : null;
          const secData = sectionId ? sectionMap.get(sectionId) : null;

          const className = clsData?.name || assign.className || assign.class || 'Class';
          let sectionName = secData?.name || assign.sectionName || assign.section || '';
          if (!sectionName) {
            if (sectionId === 'sec-1' || sectionId === 'sec-b' || sectionId === 'Section B' || String(assign.id).includes('sec-1')) {
              sectionName = 'Section B';
            } else {
              sectionName = 'Section A';
            }
          }

          let studentCount = 0;
          if (classId) {
            const sSnap = await this.db.collection('studentProfiles')
              .where('tenantId', '==', tid)
              .where('classId', '==', classId)
              .get().catch(() => null);
            if (sSnap) studentCount = sSnap.size;
          }

          return {
            ...assign,
            className,
            sectionName,
            studentCount,
            classSection: {
              id: assign.classSectionId || assign.id,
              class: { id: classId, name: className },
              section: { id: sectionId, name: sectionName },
            },
          };
        }),
      );

      const uniqueMap = new Map<string, any>();
      for (const item of resolvedList) {
        const key = `${item.className}_${item.sectionName}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, item);
        }
      }
      return Array.from(uniqueMap.values());
    }

    if (tid && assignments.length === 0) {
      const [classesSnap, sectionsSnap] = await Promise.all([
        this.db.collection('tenants').doc(tid).collection('classes').get().catch(() => null),
        this.db.collection('tenants').doc(tid).collection('sections').get().catch(() => null),
      ]);

      let classesDocs = classesSnap && !classesSnap.empty ? classesSnap.docs : [];
      if (classesDocs.length === 0) {
        const rootCls = await this.db.collection('classes').where('tenantId', '==', tid).get().catch(() => null);
        if (rootCls && !rootCls.empty) classesDocs = rootCls.docs;
      }

      let sectionsDocs = sectionsSnap && !sectionsSnap.empty ? sectionsSnap.docs : [];

      const list: any[] = [];
      for (const clsDoc of classesDocs) {
        const cData = clsDoc.data() || {};
        const cName = typeof cData.name === 'string' ? cData.name : cData.className || 'Class';
        const secDoc = sectionsDocs[0];
        const sData = secDoc ? secDoc.data() : {};
        const sName = typeof sData.name === 'string' ? sData.name : 'Section A';
        const sId = secDoc ? secDoc.id : 'sec-a';
        
        let studentCount = 0;
        const sSnap = await this.db.collection('studentProfiles')
          .where('tenantId', '==', tid)
          .where('classId', '==', clsDoc.id)
          .get().catch(() => null);
        if (sSnap) studentCount = sSnap.size;

        list.push({
          id: `${clsDoc.id}-${sId}`,
          classSectionId: `${clsDoc.id}-${sId}`,
          classId: clsDoc.id,
          sectionId: sId,
          className: cName,
          sectionName: sName,
          subjectId: 'sub-general',
          subjectName: 'General Subject',
          studentCount,
          classSection: {
            id: `${clsDoc.id}-${sId}`,
            class: { id: clsDoc.id, name: cName },
            section: { id: sId, name: sName },
          },
        });
      }
      return list;
    }

    return assignments;
  }

  async findTeacherSkills(teacherId: string): Promise<any[]> {
    const snap = await this.db.collectionGroup('teacherSkills').where('teacherId', '==', teacherId).get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async createTeacherAssignment(data: any): Promise<any> {
    if (!data.tenantId) throw new Error('tenantId is required');
    const tenantId = data.tenantId;
    const docId = data.id || DeterministicKey.teacherAssignment(data.teacherId, data.classSectionId, data.subjectId);
    const ref = this.db.collection('tenants').doc(tenantId).collection('teacherAssignments').doc(docId);
    const payload = sanitizePayload({ ...data, id: docId, tenantId });
    await ref.set(payload, { merge: true });
    return payload;
  }

  async createTeacherSkill(data: any): Promise<any> {
    if (!data.tenantId) throw new Error('tenantId is required');
    const tenantId = data.tenantId;
    const docId = data.id || DeterministicKey.teacherSkill(data.teacherId, data.subjectId);
    const ref = this.db.collection('tenants').doc(tenantId).collection('teacherSkills').doc(docId);
    const payload = sanitizePayload({ ...data, id: docId, tenantId });
    await ref.set(payload, { merge: true });
    return payload;
  }

  async createStaffProfile(data: any): Promise<any> {
    const docId = data.id || this.db.collection('staffProfiles').doc().id;
    const ref = this.db.collection('staffProfiles').doc(docId);
    const payload = sanitizePayload({ ...data, id: docId });
    await ref.set(payload, { merge: true });
    return payload;
  }

  async updateStaffProfile(id: string, data: any): Promise<any> {
    const ref = this.db.collection('staffProfiles').doc(id);
    const cleanData = sanitizePayload(data);
    await ref.set(cleanData, { merge: true });
    const doc = await ref.get();
    return { id: doc.id, ...doc.data() };
  }

  async deleteStaffProfile(id: string): Promise<any> {
    const ref = this.db.collection('staffProfiles').doc(id);
    const doc = await ref.get();
    const data = doc.exists ? { id: doc.id, ...doc.data() } : null;
    await ref.delete();
    return data;
  }
}
