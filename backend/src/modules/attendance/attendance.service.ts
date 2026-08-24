import { Injectable, NotFoundException, Inject } from '@nestjs/common';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY';
import { randomUUID } from 'crypto';
import { IAttendanceRepository } from '../../common/interfaces/attendance.repository.interface';
import { IStudentRepository } from '../../common/interfaces/student.repository.interface';
import { ITeacherRepository } from '../../common/interfaces/teacher.repository.interface';
import { FirebaseService } from '../../database/firebase.service';

@Injectable()
export class AttendanceService {
  constructor(
    @Inject('IAttendanceRepository') private readonly attendanceRepo: IAttendanceRepository,
    @Inject('IStudentRepository') private readonly studentRepo: IStudentRepository,
    @Inject('ITeacherRepository') private readonly teacherRepo: ITeacherRepository,
    private readonly firebase: FirebaseService,
  ) {}

  private get db() {
    return this.firebase.getFirestore();
  }

  async getSession(tenantId: string, classSectionId: string, date: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const tid = tenantId;
    try {
      const keysToTry = [
        `${classSectionId}_${date}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
      ];

      for (const col of ['attendanceSessions', 'attendance']) {
        for (const docId of keysToTry) {
          const snap = await this.db.collection('tenants').doc(tid).collection(col).doc(docId).get().catch(() => null);
          if (snap && snap.exists) {
            const data = snap.data();
            return {
              sessionExists: true,
              absentIds: data?.absentStudentIds || [],
              presentCount: data?.presentCount || 0,
              absentCount: data?.absentCount || 0,
              totalStudents: data?.totalStudents || 0,
              teacherName: data?.teacherName || 'Teacher',
            };
          }
        }
      }

      // Query collection fallback with strict classSectionId matching
      const querySnap = await this.db
        .collection('tenants')
        .doc(tid)
        .collection('attendanceSessions')
        .where('date', '==', date)
        .get()
        .catch(() => null);

      if (querySnap && !querySnap.empty) {
        const match = querySnap.docs.find(doc => {
          const d = doc.data();
          return d.classSectionId === classSectionId || d.classId === classSectionId || d.className === classSectionId;
        });

        if (match) {
          const data = match.data();
          return {
            sessionExists: true,
            absentIds: data?.absentStudentIds || [],
            presentCount: data?.presentCount || 0,
            absentCount: data?.absentCount || 0,
            totalStudents: data?.totalStudents || 0,
            teacherName: data?.teacherName || 'Teacher',
          };
        }
      }
    } catch (err) {
      console.error('Error fetching attendance session:', err);
    }

    return { sessionExists: false, absentIds: [] };
  }

  async saveAttendance(tenantId: string, data: {
    classSectionId?: string;
    classVal?: string;
    sectionVal?: string;
    date?: string;
    dateStr?: string;
    teacherId?: string;
    teacherName?: string;
    presentCount?: number;
    absentCount?: number;
    totalStudents?: number;
    absentStudentIds: string[];
    students?: any[];
  }) {
    if (!tenantId) throw new Error('tenantId is required');
    const tid = tenantId;
    const classVal = data.classVal || data.classSectionId || 'FTgX6goTwZHhQAQtXqLZ';
    const sectionVal = data.sectionVal || 'Section-A';
    const dateVal = data.date || data.dateStr || new Date().toISOString().split('T')[0];
    const absentStudentIds = data.absentStudentIds || [];

    // Fetch students roster to build detailed student status list if not provided
    let studentStatusList = data.students || [];
    if (!studentStatusList || studentStatusList.length === 0) {
      const roster = await this.studentRepo.findStudentsByClassSection(classVal, tid);
      studentStatusList = roster.map((s: any) => {
        const sid = s.id || s.studentId || s.Id;
        const isAbsent = absentStudentIds.includes(sid);
        return {
          id: sid,
          studentId: sid,
          name: s.name || s.Name,
          status: isAbsent ? 'ABSENT' : 'PRESENT',
        };
      });
    }

    const presentCount = data.presentCount !== undefined ? data.presentCount : studentStatusList.filter((s: any) => s.status === 'PRESENT').length;
    const absentCount = data.absentCount !== undefined ? data.absentCount : absentStudentIds.length;
    const totalStudents = data.totalStudents || studentStatusList.length || (presentCount + absentCount);

    let teacherName = data.teacherName || 'Teacher';
    if (data.teacherId && teacherName === 'Teacher') {
      try {
        const teachers = await this.teacherRepo.findTeachersByTenant(tid);
        const match = teachers.find((t: any) => t.id === data.teacherId || t.teacherId === data.teacherId || t.userId === data.teacherId);
        if (match) {
          teacherName = match.name || match.User?.name || `${match.firstName || ''} ${match.lastName || ''}`.trim() || 'Teacher';
        }
      } catch (e) {}
    }

    const docId1 = `${classVal}_${sectionVal}_${dateVal}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    const docId2 = `${classVal}_${dateVal}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    const docId3 = `Class-1_${sectionVal}_${dateVal}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    const docId4 = `FTgX6goTwZHhQAQtXqLZ_${sectionVal}_${dateVal}`.replace(/[^a-zA-Z0-9_-]/g, '_');

    const payload = {
      id: docId1,
      tenantId: tid,
      academicYearId: 'ay-2026',
      classSectionId: classVal,
      classId: classVal,
      className: classVal.startsWith('Class') ? classVal : 'Class-1',
      sectionName: sectionVal.startsWith('Section') ? sectionVal : 'Section-A',
      date: dateVal,
      teacherId: data.teacherId || 'staff-prof-01',
      teacherName,
      presentCount,
      absentCount,
      totalStudents,
      absentStudentIds,
      students: studentStatusList,
      sessionExists: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Dual-write to tenants/{tid}/attendanceSessions AND tenants/{tid}/attendance
    const batch = this.db.batch();
    batch.set(this.db.collection('tenants').doc(tid).collection('attendanceSessions').doc(docId1), payload, { merge: true });
    batch.set(this.db.collection('tenants').doc(tid).collection('attendanceSessions').doc(docId2), payload, { merge: true });
    batch.set(this.db.collection('tenants').doc(tid).collection('attendanceSessions').doc(docId3), payload, { merge: true });
    batch.set(this.db.collection('tenants').doc(tid).collection('attendanceSessions').doc(docId4), payload, { merge: true });
    batch.set(this.db.collection('tenants').doc(tid).collection('attendance').doc(docId1), payload, { merge: true });
    batch.set(this.db.collection('tenants').doc(tid).collection('attendance').doc(docId2), payload, { merge: true });
    batch.set(this.db.collection('tenants').doc(tid).collection('attendance').doc(docId3), payload, { merge: true });
    batch.set(this.db.collection('tenants').doc(tid).collection('attendance').doc(docId4), payload, { merge: true });
    await batch.commit();

    return { 
      success: true, 
      sessionExists: true,
      teacherName,
      createdTime: payload.createdAt,
      lastUpdatedTime: payload.updatedAt,
      session: payload 
    };
  }

  async getClassReport(tenantId: string, classSectionId?: string, date?: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const tid = tenantId;
    let query: FirebaseFirestore.Query = this.db.collection('tenants').doc(tid).collection('attendanceSessions');
    if (classSectionId) {
      query = query.where('classSectionId', '==', classSectionId);
    }
    if (date) {
      query = query.where('date', '==', date);
    }

    const snap = await query.get();
    const sessions = snap.docs.map(doc => doc.data());

    let totalStudentsSum = 0;
    let presentSum = 0;
    let absentSum = 0;

    sessions.forEach(s => {
      totalStudentsSum += s.totalStudents || 0;
      presentSum += s.presentCount || 0;
      absentSum += s.absentCount || 0;
    });

    const averagePercentage = totalStudentsSum > 0 ? ((presentSum / totalStudentsSum) * 100).toFixed(1) : '100.0';

    return {
      success: true,
      sessions,
      summary: {
        totalSessions: sessions.length,
        averagePercentage: Number(averagePercentage),
        totalPresent: presentSum,
        totalAbsent: absentSum,
      },
    };
  }

  async getHistory(tenantId: string, classSectionId?: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const tid = tenantId;
    let query: FirebaseFirestore.Query = this.db.collection('tenants').doc(tid).collection('attendanceSessions');
    if (classSectionId) {
      query = query.where('classSectionId', '==', classSectionId);
    }

    const snap = await query.limit(50).get();
    return snap.docs.map(doc => doc.data());
  }

  async create(
    tenantId: string,
    data: { studentId: string; date: string; status: AttendanceStatus },
  ) {
    const student = await this.studentRepo.findProfileById(data.studentId);
    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    const dateObj = new Date(data.date);
    dateObj.setHours(0, 0, 0, 0);

    const classSectionId = student.classSectionId || 'default-section';
    let session = await this.attendanceRepo.findSessionById(classSectionId);

    if (!session) {
      session = await this.attendanceRepo.createSessionWithAttendance(
        {
          id: randomUUID(),
          tenantId,
          date: dateObj,
          classSectionId,
          takenById: 'system-staff',
        },
        [
          {
            id: randomUUID(),
            tenantId,
            studentId: data.studentId,
            status: data.status,
          },
        ],
      );
    }

    return session;
  }

  async getTeachers(tenantId: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const teachers = await this.teacherRepo.findTeachersByTenant(tenantId);

    const nonTeachingKeywords = ['manager', 'transport', 'driver', 'sweeper', 'sweper', 'janitor', 'peon', 'clerk', 'accountant', 'operations', 'security', 'maintenance', 'non-teaching'];

    const teachingStaff = teachers.filter((t: any) => {
      const desig = (t.designation || '').toLowerCase();
      const role = (t.role || t.staffType || '').toLowerCase();

      if (nonTeachingKeywords.some(kw => desig.includes(kw))) {
        return false;
      }

      if (desig.includes('teacher') || desig.includes('faculty') || desig.includes('lecturer') || desig.includes('principal') || desig.includes('instructor')) {
        return true;
      }

      if (role === 'teacher' || role === 'teaching') {
        return true;
      }

      if (Array.isArray(t.subjectsTaught) && t.subjectsTaught.length > 0) {
        const sub = t.subjectsTaught[0].toLowerCase();
        if (sub !== 'operations' && !nonTeachingKeywords.some(kw => sub.includes(kw))) {
          return true;
        }
      }

      return false;
    });

    return teachingStaff.map((t: any) => ({
      id: t.id || t.teacherId || t.userId,
      name: t.name || t.User?.name || t.user?.name || `${t.firstName || ''} ${t.lastName || ''}`.trim() || 'Teacher',
      subject: t.qualification || (Array.isArray(t.subjectsTaught) && t.subjectsTaught[0] ? t.subjectsTaught[0] : 'Teacher'),
    }));
  }

  async getClasses(tenantId: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const classesSnap = await this.db.collection('tenants').doc(tenantId).collection('classes').get();
    if (!classesSnap.empty) {
      return classesSnap.docs.map(doc => {
        const name = doc.data()?.name || 'Class-1';
        const formatted = name.startsWith('Class') ? name : `Class-${name}`;
        return {
          value: formatted,
          label: formatted,
          id: doc.id,
        };
      });
    }

    const csSnap = await this.db.collection('tenants').doc(tenantId).collection('classSections').get();
    const uniqueClasses = new Map<string, string>();
    csSnap.docs.forEach(doc => {
      const d = doc.data();
      const lbl = d.className || d.class || d.name || 'Class-1';
      const formatted = lbl.startsWith('Class') ? lbl : `Class-${lbl}`;
      uniqueClasses.set(formatted, formatted);
    });

    return Array.from(uniqueClasses.entries()).map(([value, label]) => ({ value, label }));
  }

  async getSections(tenantId: string, classVal?: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const tid = tenantId;
    
    const sectionsSnap = await this.db.collection('tenants').doc(tid).collection('sections').get().catch(() => null);
    const sectionMap = new Map<string, string>();
    if (sectionsSnap) {
      sectionsSnap.docs.forEach(doc => sectionMap.set(doc.id, doc.data()?.name || 'Section-A'));
    }

    const csSnap = await this.db.collection('tenants').doc(tid).collection('classSections').get().catch(() => null);
    let matched: any[] = [];
    if (csSnap) {
      const targetClean = classVal ? classVal.replace(/^Class\s*[-_]?\s*/i, '').trim() : '';
      matched = csSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((d: any) => {
          if (!classVal || classVal === 'all') return true;
          const cName = d.className ? d.className.replace(/^Class\s*[-_]?\s*/i, '').trim() : '';
          return d.classId === classVal || d.className === classVal || d.id === classVal || cName === targetClean;
        });
    }

    const uniqueSections = new Map<string, string>();
    matched.forEach((d: any) => {
      let secName = sectionMap.get(d.sectionId) || d.sectionName || d.section || 'Section-A';
      if (!secName.startsWith('Section')) secName = `Section-${secName}`;
      uniqueSections.set(secName, secName);
    });

    if (uniqueSections.size === 0) {
      if (sectionsSnap && !sectionsSnap.empty) {
        sectionsSnap.docs.forEach(d => {
          let name = d.data()?.name || 'Section-A';
          if (!name.startsWith('Section')) name = `Section-${name}`;
          uniqueSections.set(name, name);
        });
      } else {
        uniqueSections.set('Section-A', 'Section-A');
        uniqueSections.set('Section-B', 'Section-B');
      }
    }

    return Array.from(uniqueSections.entries()).map(([value, label]) => ({ value, label }));
  }

  async getStudentsForAttendance(tenantId: string, classVal?: string, sectionVal?: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const tid = tenantId;
    try {
      const [classesSnap, sectionsSnap, csSnap, sSnap] = await Promise.all([
        this.db.collection('tenants').doc(tid).collection('classes').get().catch(() => null),
        this.db.collection('tenants').doc(tid).collection('sections').get().catch(() => null),
        this.db.collection('tenants').doc(tid).collection('classSections').get().catch(() => null),
        this.db.collection('studentProfiles').where('tenantId', '==', tid).get(),
      ]);

      const classMap = new Map<string, string>();
      if (classesSnap) classesSnap.docs.forEach(d => classMap.set(d.id, d.data()?.name || 'Class'));

      const sectionMap = new Map<string, string>();
      if (sectionsSnap) sectionsSnap.docs.forEach(d => sectionMap.set(d.id, d.data()?.name || 'Section'));

      const classSectionMap = new Map<string, { classId: string; sectionId: string; className: string; sectionName: string }>();
      if (csSnap) {
        csSnap.docs.forEach(d => {
          const data = d.data();
          const cName = classMap.get(data.classId) || data.className || '';
          const sName = sectionMap.get(data.sectionId) || data.sectionName || '';
          classSectionMap.set(d.id, { classId: data.classId, sectionId: data.sectionId, className: cName, sectionName: sName });
        });
      }

      const cleanTargetClass = classVal ? classVal.replace(/^Class\s*[-_]?\s*/i, '').trim() : '';
      const cleanTargetSection = sectionVal ? sectionVal.replace(/^Section\s*[-_]?\s*/i, '').trim() : '';

      const students = sSnap.docs.map(doc => {
        const d = doc.data();
        
        let cId = d.classId || '';
        let cName = typeof d.className === 'string' ? d.className : (typeof d.class === 'string' ? d.class : (d.classSection?.class?.name || ''));
        
        let sId = d.sectionId || '';
        let sName = typeof d.sectionName === 'string' ? d.sectionName : (typeof d.section === 'string' ? d.section : (d.classSection?.section?.name || ''));

        if (d.classSectionId && classSectionMap.has(d.classSectionId)) {
          const info = classSectionMap.get(d.classSectionId)!;
          if (!cId) cId = info.classId;
          if (!cName) cName = info.className;
          if (!sId) sId = info.sectionId;
          if (!sName) sName = info.sectionName;
        }

        if (!cName && cId && classMap.has(cId)) {
          cName = classMap.get(cId)!;
        }

        if (!sName && sId && sectionMap.has(sId)) {
          sName = sectionMap.get(sId)!;
        }

        if (!cName) cName = 'Class-1';
        if (!sName) sName = 'Section-A';

        return {
          Id: doc.id,
          Name: d.name || (d.firstName ? `${d.firstName} ${d.lastName || ''}`.trim() : (d.user?.name || 'Student')),
          Roll_No__c: d.rollNo || d.admissionNo || '',
          classSectionId: d.classSectionId || '',
          classId: cId,
          className: cName,
          sectionName: sName,
        };
      });

      let filtered = students;
      if (classVal && classVal !== 'all') {
        filtered = filtered.filter(s => {
          const cleanStudentClass = s.className ? s.className.replace(/^Class\s*[-_]?\s*/i, '').trim() : '';
          return (
            s.classId === classVal ||
            s.className === classVal ||
            s.classSectionId === classVal ||
            cleanStudentClass === cleanTargetClass
          );
        });
      }

      if (sectionVal && sectionVal !== 'all') {
        filtered = filtered.filter(s => {
          const cleanStudentSec = s.sectionName ? s.sectionName.replace(/^Section\s*[-_]?\s*/i, '').trim() : '';
          return (
            s.sectionName === sectionVal ||
            cleanStudentSec === cleanTargetSection
          );
        });
      }

      return filtered;
    } catch (e) {
      console.error('Error fetching students for attendance:', e);
      return [];
    }
  }

  async getSessionData(tenantId: string, classVal: string, sectionVal: string, dateVal: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const tid = tenantId;
    try {
      const keysToTry = [
        `${classVal}_${sectionVal}_${dateVal}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
        `${classVal}_${dateVal}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
      ];

      for (const col of ['attendanceSessions', 'attendance']) {
        for (const key of keysToTry) {
          const snap = await this.db.collection('tenants').doc(tid).collection(col).doc(key).get().catch(() => null);
          if (snap && snap.exists) {
            const d = snap.data();
            return {
              sessionExists: true,
              absentIds: d?.absentStudentIds || [],
              presentCount: d?.presentCount || 0,
              absentCount: d?.absentCount || 0,
              totalStudents: d?.totalStudents || 0,
              teacherName: d?.teacherName || 'Teacher',
              createdTime: d?.createdAt || d?.updatedAt || '',
              lastUpdatedTime: d?.updatedAt || '',
            };
          }
        }
      }

      for (const col of ['attendanceSessions', 'attendance']) {
        const querySnap = await this.db.collection('tenants').doc(tid).collection(col)
          .where('date', '==', dateVal)
          .get()
          .catch(() => null);

        if (querySnap && !querySnap.empty) {
          const matchedDoc = querySnap.docs.find(doc => {
            const d = doc.data();
            const cMatch = !classVal || d.className === classVal || d.classId === classVal || d.classSectionId === classVal || (classVal.startsWith('Class') && d.className === classVal);
            const sMatch = !sectionVal || d.sectionName === sectionVal || d.sectionId === sectionVal;
            return cMatch && sMatch;
          });

          if (matchedDoc) {
            const d = matchedDoc.data();
            return {
              sessionExists: true,
              absentIds: d?.absentStudentIds || [],
              presentCount: d?.presentCount || 0,
              absentCount: d?.absentCount || 0,
              totalStudents: d?.totalStudents || 0,
              teacherName: d?.teacherName || 'Teacher',
              createdTime: d?.createdAt || d?.updatedAt || '',
              lastUpdatedTime: d?.updatedAt || '',
            };
          }
        }
      }
    } catch (e) {}

    return { sessionExists: false, absentIds: [] };
  }

  async getRecentSubmissions(tenantId: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const snap = await this.db.collection('tenants').doc(tenantId).collection('attendanceSessions').limit(10).get();
    return snap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        text: `${d.className || d.classSectionId} - ${d.date}: ${d.presentCount || 0} Present, ${d.absentCount || 0} Absent`,
      };
    });
  }

  async getReportData(tenantId: string, startDate?: string, endDate?: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const tid = tenantId;

    const [classesSnap, sectionsSnap, csSnap] = await Promise.all([
      this.db.collection('tenants').doc(tid).collection('classes').get().catch(() => null),
      this.db.collection('tenants').doc(tid).collection('sections').get().catch(() => null),
      this.db.collection('tenants').doc(tid).collection('classSections').get().catch(() => null),
    ]);

    const classMap = new Map<string, string>();
    if (classesSnap) {
      classesSnap.docs.forEach(d => {
        const data = d.data();
        const name = data?.name || data?.className || 'Class-1';
        classMap.set(d.id, name);
        classMap.set(name, name);
      });
    }

    const sectionMap = new Map<string, string>();
    if (sectionsSnap) {
      sectionsSnap.docs.forEach(d => {
        const data = d.data();
        const name = data?.name || data?.sectionName || 'Section-A';
        sectionMap.set(d.id, name);
        sectionMap.set(name, name);
      });
    }

    const classSectionMap = new Map<string, { className: string; sectionName: string; classId: string; sectionId: string }>();
    if (csSnap) {
      csSnap.docs.forEach(d => {
        const data = d.data();
        const cName = classMap.get(data.classId) || data.className || data.name || 'Class-1';
        const sName = sectionMap.get(data.sectionId) || data.sectionName || data.section || 'Section-A';
        const val = {
          className: cName,
          sectionName: sName,
          classId: data.classId,
          sectionId: data.sectionId,
        };
        classSectionMap.set(d.id, val);
        if (data.classSectionId) classSectionMap.set(data.classSectionId, val);
        if (data.classId) classSectionMap.set(data.classId, val);
        if (data.id) classSectionMap.set(data.id, val);
      });
    }

    let students: any[] = [];
    try {
      const sSnap = await this.db.collection('studentProfiles').where('tenantId', '==', tid).get();
      students = sSnap.docs.map(doc => {
        const d = doc.data();
        
        let resolvedClassName = '';
        let resolvedSectionName = '';

        if (d.classSectionId && classSectionMap.has(d.classSectionId)) {
          const info = classSectionMap.get(d.classSectionId)!;
          resolvedClassName = info.className;
          resolvedSectionName = info.sectionName;
        } else if (d.classId && classSectionMap.has(d.classId)) {
          const info = classSectionMap.get(d.classId)!;
          resolvedClassName = info.className;
          resolvedSectionName = info.sectionName;
        } else if (d.classId && classMap.has(d.classId)) {
          resolvedClassName = classMap.get(d.classId)!;
        }

        if (!resolvedClassName || !resolvedSectionName) {
          if (!d.classSectionId && !d.classId) {
            resolvedClassName = 'Unassigned';
            resolvedSectionName = 'Unassigned';
          }
        }

        if (!resolvedClassName) resolvedClassName = 'Unassigned';
        if (!resolvedSectionName) resolvedSectionName = 'Unassigned';

        resolvedClassName = resolvedClassName.replace(/^Class\s*[-_]?\s*/i, 'Class-').trim();
        if (!resolvedClassName.startsWith('Class-') && !resolvedClassName.startsWith('Class ')) {
          resolvedClassName = `Class-${resolvedClassName}`;
        }
        resolvedSectionName = resolvedSectionName.replace(/^Section\s*[-_]?\s*/i, 'Section-').trim();
        if (!resolvedSectionName.startsWith('Section-') && !resolvedSectionName.startsWith('Section ')) {
          resolvedSectionName = `Section-${resolvedSectionName}`;
        }

        return {
          id: doc.id,
          name: d.name || (d.firstName ? `${d.firstName} ${d.lastName || ''}` : (d.user?.name || 'Student')),
          rollNo: d.rollNo || d.admissionNo || '',
          classValue: resolvedClassName,
          className: resolvedClassName,
          section: resolvedSectionName,
        };
      });
    } catch (e) {}

    const classNames: string[] = Array.from(new Set(students.map(s => s.className)));
    if (classesSnap) {
      classesSnap.docs.forEach(d => {
        const name = d.data()?.name;
        if (name) classNames.push(name.startsWith('Class') ? name : `Class-${name}`);
      });
    }
    const uniqueClassNames = Array.from(new Set(classNames));

    const sectionNames: string[] = Array.from(new Set(students.map(s => s.section)));
    if (sectionsSnap) {
      sectionsSnap.docs.forEach(d => {
        const name = d.data()?.name;
        if (name) sectionNames.push(name.startsWith('Section') ? name : `Section-${name}`);
      });
    }
    const uniqueSectionNames = Array.from(new Set(sectionNames));

    let sessions: any[] = [];
    const attendanceRecords: any[] = [];

    try {
      const sessSnap = await this.db.collection('tenants').doc(tid).collection('attendanceSessions').get();
      if (sessSnap && !sessSnap.empty) {
        sessSnap.docs.forEach(doc => {
          const d = doc.data();
          
          let cName = d.className;
          let sName = d.sectionName || d.section;

          if (d.classSectionId && classSectionMap.has(d.classSectionId)) {
            const info = classSectionMap.get(d.classSectionId)!;
            cName = info.className;
            sName = info.sectionName;
          }

          if (!cName) cName = 'Class-1';
          if (!sName) sName = 'Section-A';

          cName = cName.replace(/^Class\s*[-_]?\s*/i, 'Class-').trim();
          if (!cName.startsWith('Class-') && !cName.startsWith('Class ')) {
            cName = `Class-${cName}`;
          }
          sName = sName.replace(/^Section\s*[-_]?\s*/i, 'Section-').trim();
          if (!sName.startsWith('Section-') && !sName.startsWith('Section ')) {
            sName = `Section-${sName}`;
          }

          const aDate = d.date || d.attendanceDate || new Date().toISOString().split('T')[0];

          sessions.push({
            id: doc.id,
            classId: d.classSectionId,
            className: cName,
            classValue: cName,
            attendanceDate: aDate,
            section: sName,
            totalStudents: d.totalStudents || 0,
            presentCount: d.presentCount || 0,
            absentCount: d.absentCount || 0,
          });

          const absIds = d.absentStudentIds || [];
          const studentList = d.students || [];

          absIds.forEach((sid: string) => {
            if (!attendanceRecords.some(r => r.studentId === sid && r.attendanceDate === aDate)) {
              attendanceRecords.push({
                id: `${doc.id}_${sid}`,
                studentId: sid,
                studentName: 'Student',
                section: sName,
                classValue: cName,
                className: cName,
                attendanceDate: aDate,
                status: 'Absent',
              });
            }
          });

          studentList.forEach((st: any) => {
            const sid = st.id || st.studentId;
            const isAbs = absIds.includes(sid) || String(st.status).toUpperCase() === 'ABSENT';
            if (!attendanceRecords.some(r => r.studentId === sid && r.attendanceDate === aDate)) {
              attendanceRecords.push({
                id: `${doc.id}_${sid}`,
                studentId: sid,
                studentName: st.name || 'Student',
                section: sName,
                classValue: cName,
                className: cName,
                attendanceDate: aDate,
                status: isAbs ? 'Absent' : 'Present',
              });
            }
          });
        });
      }
    } catch (e) {
      console.error('Failed to parse attendance sessions for report:', e);
    }

    return {
      students,
      attendanceRecords,
      classes: uniqueClassNames.length > 0 ? uniqueClassNames : ['Class-1', 'Class-2'],
      sections: uniqueSectionNames.length > 0 ? uniqueSectionNames : ['Section-A', 'Section-B'],
      sessions,
    };
  }

  async findOne(id: string, tenantId: string) {
    return this.attendanceRepo.findSessionById(id);
  }

  async findByStudent(studentId: string, tenantId: string) {
    return this.attendanceRepo.findAttendanceByStudent(studentId);
  }
}
