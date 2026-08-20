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
      const docId = `${classSectionId}_${date}`.replace(/[^a-zA-Z0-9_-]/g, '_');
      const docRef = this.db.collection('tenants').doc(tid).collection('attendanceSessions').doc(docId);
      const snap = await docRef.get();

      if (snap.exists) {
        const data = snap.data();
        return {
          sessionExists: true,
          absentIds: data?.absentStudentIds || [],
          presentCount: data?.presentCount || 0,
          absentCount: data?.absentCount || 0,
          totalStudents: data?.totalStudents || 0,
        };
      }

      // Query collection fallback
      const querySnap = await this.db
        .collection('tenants')
        .doc(tid)
        .collection('attendanceSessions')
        .where('classSectionId', '==', classSectionId)
        .where('date', '==', date)
        .limit(1)
        .get();

      if (!querySnap.empty) {
        const data = querySnap.docs[0].data();
        return {
          sessionExists: true,
          absentIds: data?.absentStudentIds || [],
          presentCount: data?.presentCount || 0,
          absentCount: data?.absentCount || 0,
          totalStudents: data?.totalStudents || 0,
        };
      }
    } catch (err) {
      console.error('Error fetching attendance session:', err);
    }

    return { sessionExists: false, absentIds: [] };
  }

  async saveAttendance(tenantId: string, data: {
    classSectionId: string;
    date: string;
    teacherId?: string;
    presentCount?: number;
    absentCount?: number;
    totalStudents?: number;
    absentStudentIds: string[];
  }) {
    if (!tenantId) throw new Error('tenantId is required');
    const tid = tenantId;
    const docId = `${data.classSectionId}_${data.date}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    const docRef = this.db.collection('tenants').doc(tid).collection('attendanceSessions').doc(docId);

    const payload = {
      id: docId,
      tenantId: tid,
      classSectionId: data.classSectionId,
      date: data.date,
      teacherId: data.teacherId || 'default-teacher',
      presentCount: data.presentCount || 0,
      absentCount: data.absentCount || 0,
      totalStudents: data.totalStudents || 0,
      absentStudentIds: data.absentStudentIds || [],
      sessionExists: true,
      updatedAt: new Date().toISOString(),
    };

    await docRef.set(payload, { merge: true });

    return { success: true, session: payload };
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

  async findAll(tenantId: string) {
    return this.attendanceRepo.findSessionsByClassSection(tenantId);
  }

  async findOne(id: string, tenantId: string) {
    return this.attendanceRepo.findSessionById(id);
  }

  async findByStudent(studentId: string, tenantId: string) {
    return this.attendanceRepo.findAttendanceByStudent(studentId);
  }
}
