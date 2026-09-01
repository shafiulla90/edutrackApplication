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

  async reconcileLegacyTeachers(tenantId: string): Promise<any> {
    const tid = tenantId || 'tenant-test-001';

    // 1. Fetch users with role TEACHER for this tenant
    const teacherUsersSnap = await this.db
      .collection('users')
      .where('tenantId', '==', tid)
      .where('role', '==', 'TEACHER')
      .get();

    // 2. Fetch staffProfiles for this tenant
    const staffProfilesSnap = await this.db
      .collection('staffProfiles')
      .where('tenantId', '==', tid)
      .get();

    const existingUserIdSet = new Set<string>();
    staffProfilesSnap.docs.forEach((doc) => {
      const data = doc.data();
      if (data.userId) {
        existingUserIdSet.add(data.userId);
      }
    });

    let createdCount = 0;
    let reconciledCount = 0;

    for (const uDoc of teacherUsersSnap.docs) {
      const userData = { id: uDoc.id, ...uDoc.data() };
      const userId = userData.id;

      if (!existingUserIdSet.has(userId)) {
        // User has role TEACHER but no StaffProfile document!
        // Check if legacy teacher assignment data exists
        const legacyAssignSnap = await this.db
          .collection('tenants')
          .doc(tid)
          .collection('teacherAssignments')
          .where('userId', '==', userId)
          .get();

        let legacyData: any = {};
        if (!legacyAssignSnap.empty) {
          legacyData = legacyAssignSnap.docs[0].data();
        }

        const staffProfileId = `sp-${userId}`;
        const newStaffProfile = sanitizePayload({
          id: staffProfileId,
          userId: userId,
          tenantId: tid,
          employeeId: legacyData.employeeId || `EMP-T-${userId.substring(0, 4).toUpperCase()}`,
          designation: 'Teacher',
          qualification: legacyData.qualification || '',
          joiningDate: new Date().toISOString().split('T')[0],
          status: 'Active',
          basicSalary: Number(legacyData.basicSalary) || 30000,
          allowances: 3600,
          pfDeduction: 1500,
          subjectsTaught: legacyData.subjectsTaught || [],
          createdAt: new Date().toISOString(),
        });

        const batch = this.db.batch();
        const profileRef = this.db.collection('staffProfiles').doc(staffProfileId);
        batch.set(profileRef, newStaffProfile, { merge: true });

        // Update teacherSkills to point teacherId to staffProfileId if needed
        const legacyDocId = legacyData.id || `teacher-${userId.replace('user-t-', '')}`;
        const skillsSnap = await this.db.collection('tenants').doc(tid).collection('teacherSkills').where('teacherId', '==', legacyDocId).get();
        skillsSnap.docs.forEach((sDoc) => {
          batch.set(sDoc.ref, { teacherId: staffProfileId, userId }, { merge: true });
        });


        await batch.commit();
        existingUserIdSet.add(userId);
        createdCount++;
      } else {
        reconciledCount++;
      }
    }

    return {
      success: true,
      tenantId: tid,
      totalTeachersFound: teacherUsersSnap.size,
      createdMissingProfiles: createdCount,
      alreadyUnifiedProfiles: reconciledCount,
    };
  }

  async findTeachersByTenant(tenantId: string): Promise<any[]> {
    const tid = tenantId || 'tenant-test-001';

    // 1. Query staffProfiles directly by tenantId
    const staffProfilesSnap = await this.db.collection('staffProfiles').where('tenantId', '==', tid).get();
    
    // 2. Query users with role TEACHER, STAFF, DRIVER for this tenant
    const [teacherSnap, staffSnap, driverSnap] = await Promise.all([
      this.db.collection('users').where('tenantId', '==', tid).where('role', '==', 'TEACHER').get(),
      this.db.collection('users').where('tenantId', '==', tid).where('role', '==', 'STAFF').get(),
      this.db.collection('users').where('tenantId', '==', tid).where('role', '==', 'DRIVER').get(),
    ]);

    const allUserDocs = [...teacherSnap.docs, ...staffSnap.docs, ...driverSnap.docs];
    const userMap = new Map<string, any>();
    allUserDocs.forEach((uDoc) => {
      userMap.set(uDoc.id, { id: uDoc.id, ...uDoc.data() });
    });

    const profilesByUserId = new Map<string, any>();
    const resultProfiles: any[] = [];

    staffProfilesSnap.docs.forEach((doc) => {
      const data = { id: doc.id, ...doc.data() };
      const userData = userMap.get((data as any).userId) || null;
      const fullProfile = {
        ...data,
        User: userData,
        user: userData,
      };
      if ((data as any).userId) {
        profilesByUserId.set((data as any).userId, fullProfile);
      }
      resultProfiles.push(fullProfile);
    });

    // 3. For any user with role TEACHER, STAFF, or DRIVER in this tenant that doesn't have a staffProfile record yet,
    // synthesize a profile object in-memory so read operation is complete without missing staff members.
    allUserDocs.forEach((uDoc) => {
      const userData = { id: uDoc.id, ...uDoc.data() };
      if (!profilesByUserId.has(userData.id)) {
        const isTeaching = userData.role === 'TEACHER';
        const designation = isTeaching ? 'Teacher' : userData.role === 'DRIVER' ? 'Transport Driver' : 'Staff Member';
        const department = isTeaching ? 'Academics' : userData.role === 'DRIVER' ? 'Transport' : 'Administration';
        
        const syntheticProfile = {
          id: `sp-${userData.id}`,
          userId: userData.id,
          tenantId: tid,
          employeeId: `EMP-${userData.role?.[0] || 'S'}-${userData.id.substring(0, 4).toUpperCase()}`,
          designation,
          department,
          qualification: 'Qualified Staff',
          joiningDate: new Date().toISOString().split('T')[0],
          status: 'Active',
          basicSalary: isTeaching ? 30000 : 22000,
          allowances: 3600,
          pfDeduction: 1500,
          subjectsTaught: isTeaching ? ['Mathematics', 'Science'] : [],
          User: userData,
          user: userData,
        };
        resultProfiles.push(syntheticProfile);
        profilesByUserId.set(userData.id, syntheticProfile);
      }
    });

    return resultProfiles;
  }


  async findTeacherAssignments(teacherId: string): Promise<any[]> {
    const snap = await this.db.collectionGroup('teacherAssignments').where('teacherId', '==', teacherId).get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async findTeacherSkills(teacherId: string): Promise<any[]> {
    const snap = await this.db.collectionGroup('teacherSkills').where('teacherId', '==', teacherId).get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async createTeacherAssignment(data: any): Promise<any> {
    const tenantId = data.tenantId || 'tenant-test-001';
    const docId = data.id || DeterministicKey.teacherAssignment(data.teacherId, data.classSectionId, data.subjectId);
    const ref = this.db.collection('tenants').doc(tenantId).collection('teacherAssignments').doc(docId);
    const payload = sanitizePayload({ ...data, id: docId, tenantId });
    await ref.set(payload, { merge: true });
    return payload;
  }

  async createTeacherSkill(data: any): Promise<any> {
    const tenantId = data.tenantId || 'tenant-test-001';
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
