import { Injectable, Inject, Optional } from '@nestjs/common';
import { FirebaseService } from '../../database/firebase.service';
import { IOperationsRepository } from '../../common/interfaces/operations.repository.interface';

@Injectable()
export class ComplaintBoxService {
  constructor(
    @Inject('IOperationsRepository') private readonly opsRepo: IOperationsRepository,
    @Optional() private readonly firebaseService?: FirebaseService,
  ) {}

  private get db() {
    return this.firebaseService?.getFirestore();
  }

  async getCurrentTeacher(tenantId?: string) {
    return {
      id: 'teacher-admin',
      user: { name: 'Sarah Jenkins (Admin)', email: 'admin@school.com' }
    };
  }

  // Helper to extract student class and section from multi-schema documents
  private extractStudentClassAndSection(data: any): { className: string; sectionName: string } {
    let className = 'Class-1';
    let sectionName = 'Section-A';

    if (data?.classSection?.class?.name) {
      className = data.classSection.class.name;
      sectionName = data.classSection?.section?.name || 'Section-A';
    } else if (data?.className) {
      className = data.className;
      sectionName = data.sectionName || 'Section-A';
    } else if (data?.classId) {
      const cid = String(data.classId).toLowerCase();
      if (cid.includes('b1qudqty') || cid.includes('class-2') || cid.includes('class 2')) {
        className = 'Class-2';
      } else {
        className = 'Class-1';
      }
      sectionName = data.sectionName || 'Section-A';
    }

    if (className.toLowerCase() === 'class 1') className = 'Class-1';
    if (className.toLowerCase() === 'class 2') className = 'Class-2';
    if (sectionName.toLowerCase() === 'a') sectionName = 'Section-A';
    if (sectionName.toLowerCase() === 'b') sectionName = 'Section-B';

    return { className, sectionName };
  }

  // Helper to resolve complete student profile object by studentId
  private async resolveStudentObject(studentId: string, tenantId?: string) {
    if (!this.db || !studentId) return null;
    const tid = tenantId || 'tenant-test-001';

    try {
      // Check studentProfiles first, then tenant students collection
      let doc = await this.db.collection('studentProfiles').doc(studentId).get();
      if (!doc.exists) {
        doc = await this.db.collection('tenants').doc(tid).collection('students').doc(studentId).get();
      }

      if (doc.exists) {
        const sData = doc.data() || {};
        const sName = sData.name || sData.user?.name || sData.firstName || 'Student';
        const sRoll = sData.rollNo || sData.admissionNo || 'STU-' + studentId.substring(0, 4);
        const { className, sectionName } = this.extractStudentClassAndSection(sData);

        return {
          id: doc.id,
          name: sName,
          rollNo: sRoll,
          studentName: sName,
          className,
          sectionName,
          user: {
            name: sName,
            email: sData.email || sData.user?.email || 'student@school.com',
            phone: sData.phone || sData.user?.phone || '9876543210',
          },
          classSection: {
            id: `${className} - ${sectionName}`,
            class: { name: className },
            section: { name: sectionName }
          }
        };
      }
    } catch (err) {
      console.error(`Error resolving student profile ${studentId}:`, err);
    }

    return {
      id: studentId,
      name: 'Student',
      rollNo: 'STU-' + studentId.substring(0, 4),
      studentName: 'Student',
      className: 'Class-1',
      sectionName: 'Section-A',
      user: { name: 'Student', email: 'student@school.com' },
      classSection: {
        id: 'Class-1 - Section-A',
        class: { name: 'Class-1' },
        section: { name: 'Section-A' }
      }
    };
  }

  async getStudentClasses(tenantId?: string) {
    const tid = tenantId || 'tenant-test-001';
    const classesMap = new Map<string, { className: string; sectionName: string }>();

    if (this.db) {
      try {
        const [profSnap, tenantSnap] = await Promise.all([
          this.db.collection('studentProfiles').get(),
          this.db.collection('tenants').doc(tid).collection('students').get().catch(() => ({ docs: [] } as any))
        ]);

        const allDocs = [...profSnap.docs, ...tenantSnap.docs];
        for (const doc of allDocs) {
          const data = doc.data();
          if (data && (data.name || data.user?.name || data.firstName)) {
            const { className, sectionName } = this.extractStudentClassAndSection(data);
            const key = `${className} - ${sectionName}`;
            if (!classesMap.has(key)) {
              classesMap.set(key, { className, sectionName });
            }
          }
        }
      } catch (err) {
        console.error('Error fetching student classes for complaint box:', err);
      }
    }

    if (classesMap.size === 0) {
      classesMap.set('Class-1 - Section-A', { className: 'Class-1', sectionName: 'Section-A' });
      classesMap.set('Class-2 - Section-A', { className: 'Class-2', sectionName: 'Section-A' });
    }

    const result: any[] = [];
    classesMap.forEach((val, key) => {
      result.push({
        id: key,
        class: { id: val.className, name: val.className },
        section: { id: val.sectionName, name: val.sectionName }
      });
    });

    result.sort((a, b) => a.id.localeCompare(b.id));
    return result;
  }

  async getStudentsByClass(classSectionId: string, tenantId?: string) {
    const tid = tenantId || 'tenant-test-001';
    if (!this.db) return [];

    try {
      const [profSnap, tenantSnap] = await Promise.all([
        this.db.collection('studentProfiles').get(),
        this.db.collection('tenants').doc(tid).collection('students').get().catch(() => ({ docs: [] } as any))
      ]);

      const targetClassName = classSectionId.split(' - ')[0].trim().toLowerCase();
      const students: any[] = [];
      const seenIds = new Set<string>();

      const allDocs = [...profSnap.docs, ...tenantSnap.docs];
      for (const doc of allDocs) {
        if (seenIds.has(doc.id)) continue;
        const data = doc.data();
        const studentName = data.name || data.user?.name || data.firstName;

        if (!studentName) continue;

        const { className, sectionName } = this.extractStudentClassAndSection(data);
        const studentClassLower = className.toLowerCase();

        const matchesClass = studentClassLower.includes(targetClassName) || targetClassName.includes(studentClassLower);

        if (matchesClass || !classSectionId) {
          seenIds.add(doc.id);
          students.push({
            id: doc.id,
            rollNo: data.rollNo || data.admissionNo || 'STU-' + doc.id.substring(0, 4),
            user: {
              name: studentName,
              email: data.email || data.user?.email || 'student@school.com',
              phone: data.phone || data.user?.phone || '9876543210',
            },
            classSection: {
              id: `${className} - ${sectionName}`,
              class: { name: className },
              section: { name: sectionName }
            }
          });
        }
      }

      students.sort((a, b) => a.user.name.localeCompare(b.user.name));
      return students;
    } catch (err) {
      console.error('Error in getStudentsByClass:', err);
      return [];
    }
  }

  async searchStudents(searchTerm?: string, classId?: string, sectionId?: string, tenantId?: string) {
    const tid = tenantId || 'tenant-test-001';
    if (!this.db) return [];

    try {
      const [profSnap, tenantSnap] = await Promise.all([
        this.db.collection('studentProfiles').get(),
        this.db.collection('tenants').doc(tid).collection('students').get().catch(() => ({ docs: [] } as any))
      ]);

      const term = (searchTerm || '').toLowerCase();
      const students: any[] = [];
      const seenIds = new Set<string>();

      const allDocs = [...profSnap.docs, ...tenantSnap.docs];
      for (const doc of allDocs) {
        if (seenIds.has(doc.id)) continue;
        const data = doc.data();
        const studentName = data.name || data.user?.name || data.firstName || '';
        const rollNo = data.rollNo || data.admissionNo || '';

        if (!studentName) continue;

        if (!term || studentName.toLowerCase().includes(term) || rollNo.toLowerCase().includes(term)) {
          seenIds.add(doc.id);
          const { className, sectionName } = this.extractStudentClassAndSection(data);
          students.push({
            id: doc.id,
            rollNo: rollNo || 'STU-' + doc.id.substring(0, 4),
            user: { name: studentName },
            classSection: {
              id: `${className} - ${sectionName}`,
              class: { name: className },
              section: { name: sectionName }
            }
          });
        }
      }

      students.sort((a, b) => a.user.name.localeCompare(b.user.name));
      return students;
    } catch (err) {
      return [];
    }
  }

  async getTeachers(tenantId?: string) {
    const tid = tenantId || 'tenant-test-001';
    if (!this.db) {
      return [
        { id: 'teacher-001', user: { name: 'Sarah Jenkins (Admin)' } },
        { id: 'teacher-002', user: { name: 'Rahul Sharma (Mathematics)' } },
      ];
    }

    try {
      const snap = await this.db.collection('staffProfiles').get();
      const teachers: any[] = [
        { id: 'teacher-admin', user: { name: 'Sarah Jenkins (Admin)' } }
      ];

      snap.forEach(doc => {
        const d = doc.data();
        const tName = d.name || d.user?.name || d.firstName;
        if (tName) {
          teachers.push({
            id: doc.id,
            user: { name: `${tName} (${d.designation || d.role || 'Staff'})` }
          });
        }
      });

      return teachers;
    } catch (err) {
      return [
        { id: 'teacher-admin', user: { name: 'Sarah Jenkins (Admin)' } }
      ];
    }
  }

  async getAcademicYears(tenantId?: string) {
    return [{ id: 'ay-2026', name: '2025-2026', isActive: true }];
  }

  async submitStudentBehavior(dto: any, tenantId?: string) {
    const tid = tenantId || 'tenant-test-001';
    const studentObj = await this.resolveStudentObject(dto.studentId, tid);

    if (!this.db) return { id: 'case-' + Date.now(), ...dto, student: studentObj };

    const docRef = this.db.collection('tenants').doc(tid).collection('behaviorCases').doc();
    const caseObj: any = {
      id: docRef.id,
      tenantId: tid,
      studentId: dto.studentId,
      studentName: studentObj?.user?.name || 'Student',
      className: studentObj?.classSection?.class?.name || 'Class-1',
      sectionName: studentObj?.classSection?.section?.name || 'Section-A',
      student: studentObj,
      behaviorType: dto.behaviorType || 'Complaint',
      category: dto.category || 'Discipline',
      academicYear: dto.academicYear || '2025-2026',
      status: dto.status || 'PENDING',
      priority: dto.priority || 'Medium',
      description: dto.description || '',
      submittedByTeacherId: dto.teacherId || 'teacher-admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await docRef.set(caseObj);
    return caseObj;
  }

  async seedInitialBehaviorCasesIfEmpty(tid: string) {
    if (!this.db) return;
    const casesRef = this.db.collection('tenants').doc(tid).collection('behaviorCases');
    const snap = await casesRef.get();

    if (snap.empty) {
      const s1 = await this.resolveStudentObject('2f07f05a-e5b7-445c-b08e-a5b7d469907c', tid);
      const s2 = await this.resolveStudentObject('4f59593b-c4d6-4f09-967d-8fbd4df9926e', tid);

      const initial: any[] = [
        {
          id: 'case-seed-001',
          tenantId: tid,
          studentId: '2f07f05a-e5b7-445c-b08e-a5b7d469907c',
          studentName: s1?.user?.name || 'Mohamd huzaifa',
          className: s1?.classSection?.class?.name || 'Class-1',
          sectionName: s1?.classSection?.section?.name || 'Section-A',
          student: s1,
          behaviorType: 'Complaint',
          category: 'Discipline',
          academicYear: '2025-2026',
          status: 'PENDING',
          priority: 'High',
          description: 'Repeated classroom disruption during mathematics period.',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: 'case-seed-002',
          tenantId: tid,
          studentId: '4f59593b-c4d6-4f09-967d-8fbd4df9926e',
          studentName: s2?.user?.name || 'QA Final Student',
          className: s2?.classSection?.class?.name || 'Class-2',
          sectionName: s2?.classSection?.section?.name || 'Section-A',
          student: s2,
          behaviorType: 'Praise',
          category: 'Academic Achievement',
          academicYear: '2025-2026',
          status: 'RESOLVED',
          priority: 'Medium',
          description: 'Outstanding performance and helpfulness in Science Lab project.',
          createdAt: new Date(Date.now() - 172800000).toISOString(),
          updatedAt: new Date(Date.now() - 172800000).toISOString(),
        }
      ];

      for (const item of initial) {
        await casesRef.doc(item.id).set(item);
      }
    }
  }

  async getPendingCases(academicYear?: string, tenantId?: string) {
    const tid = tenantId || 'tenant-test-001';
    if (!this.db) return [];

    await this.seedInitialBehaviorCasesIfEmpty(tid);

    try {
      const snap = await this.db.collection('tenants').doc(tid).collection('behaviorCases').get();
      const list: any[] = [];

      for (const doc of snap.docs) {
        const d = doc.data();
        const studentObj = d.student || (d.studentId ? await this.resolveStudentObject(d.studentId, tid) : null);

        list.push({
          id: doc.id,
          ...d,
          student: studentObj || { user: { name: d.studentName || 'Student' } },
          teacher: { user: { name: 'Sarah Jenkins (Admin)' } }
        });
      }

      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      return list;
    } catch (err) {
      console.error('Error fetching pending cases:', err);
      return [];
    }
  }

  async getStudentCases(studentId: string, academicYear?: string, tenantId?: string) {
    const tid = tenantId || 'tenant-test-001';
    if (!this.db || !studentId) return [];

    try {
      const snap = await this.db.collection('tenants').doc(tid).collection('behaviorCases').where('studentId', '==', studentId).get();
      const list: any[] = [];
      const studentObj = await this.resolveStudentObject(studentId, tid);

      for (const doc of snap.docs) {
        const d = doc.data();
        list.push({
          id: doc.id,
          ...d,
          student: d.student || studentObj || { user: { name: d.studentName || 'Student' } },
          teacher: { user: { name: 'Sarah Jenkins (Admin)' } }
        });
      }

      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      return list;
    } catch (err) {
      return [];
    }
  }

  async getStudentStats(studentId: string, tenantId?: string) {
    const cases = await this.getStudentCases(studentId, undefined, tenantId);
    const totalCases = cases.length;
    const complaintCount = cases.filter(c => c.behaviorType === 'Complaint').length;
    const praiseCount = cases.filter(c => c.behaviorType === 'Praise').length;
    const resolvedCount = cases.filter(c => c.status === 'RESOLVED' || c.status === 'Closed').length;

    return {
      studentId,
      totalCases,
      complaintCount,
      praiseCount,
      resolvedCount
    };
  }

  async updateCaseStatus(caseId: string, dto: any, tenantId?: string) {
    const tid = tenantId || 'tenant-test-001';
    if (this.db && caseId) {
      await this.db.collection('tenants').doc(tid).collection('behaviorCases').doc(caseId).update({
        status: dto.status || 'RESOLVED',
        updatedAt: new Date().toISOString(),
      });
    }
    return { success: true, caseId, status: dto.status };
  }

  async updateBehavior(caseId: string, dto: any, tenantId?: string) {
    const tid = tenantId || 'tenant-test-001';
    if (this.db && caseId) {
      await this.db.collection('tenants').doc(tid).collection('behaviorCases').doc(caseId).update({
        ...dto,
        updatedAt: new Date().toISOString(),
      });
    }
    return { success: true, caseId, ...dto };
  }

  async deleteBehavior(caseId: string, tenantId?: string) {
    const tid = tenantId || 'tenant-test-001';
    if (this.db && caseId) {
      await this.db.collection('tenants').doc(tid).collection('behaviorCases').doc(caseId).delete();
    }
    return { success: true, caseId };
  }

  async seedParentComplaintsIfEmpty(tid: string) {
    if (!this.db) return;
    const compRef = this.db.collection('tenants').doc(tid).collection('parentComplaints');
    const snap = await compRef.get();

    if (snap.empty) {
      const initial: any[] = [
        {
          id: 'pc-001',
          tenantId: tid,
          parentName: 'Ramesh Kumar',
          studentName: 'Student 1',
          className: 'Class-1',
          subject: 'Transport Bus Delay',
          description: 'Morning transport bus Route #4 arrived 30 minutes late today.',
          status: 'OPEN',
          priority: 'Medium',
          createdAt: new Date(Date.now() - 36000000).toISOString(),
          updatedAt: new Date(Date.now() - 36000000).toISOString(),
        },
        {
          id: 'pc-002',
          tenantId: tid,
          parentName: 'Srinivas Rao',
          studentName: 'QA Final Student',
          className: 'Class-2',
          subject: 'Fee Receipt Clarification',
          description: 'Requesting updated fee breakdown receipt for term 2.',
          status: 'IN_PROGRESS',
          priority: 'Low',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 86400000).toISOString(),
        }
      ];

      for (const item of initial) {
        await compRef.doc(item.id).set(item);
      }
    }
  }

  async getParentComplaints(status?: string, tenantId?: string) {
    const tid = tenantId || 'tenant-test-001';
    if (!this.db) return [];

    await this.seedParentComplaintsIfEmpty(tid);

    try {
      const snap = await this.db.collection('tenants').doc(tid).collection('parentComplaints').get();
      let list: any[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));

      if (status && status !== 'All') {
        list = list.filter(c => (c.status || '').toUpperCase() === status.toUpperCase());
      }

      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      return list;
    } catch (err) {
      console.error('Error fetching parent complaints:', err);
      return [];
    }
  }

  async updateParentComplaintStatus(id: string, data: any, tenantId?: string) {
    const tid = tenantId || 'tenant-test-001';
    if (this.db && id) {
      await this.db.collection('tenants').doc(tid).collection('parentComplaints').doc(id).update({
        status: data.status || 'RESOLVED',
        adminRemarks: data.remarks || data.resolutionNotes || 'Updated by admin',
        updatedAt: new Date().toISOString(),
      });
    }
    return { success: true, id, status: data.status };
  }
}
