import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase.service';
import { IAttendanceRepository } from '../../../common/interfaces/attendance.repository.interface';
import { formatDateISO } from '../../../common/utils/migration-helpers';

@Injectable()
export class FirestoreAttendanceRepository implements IAttendanceRepository {
  constructor(private readonly firebase: FirebaseService) {}

  private get db() {
    return this.firebase.getFirestore();
  }

  async findSessionsByClassSection(classSectionIdOrTenantId: string, startDate?: string, endDate?: string): Promise<any[]> {
    const tid = classSectionIdOrTenantId || 'tenant-test-001';
    let snap: FirebaseFirestore.QuerySnapshot;
    try {
      const tenantSnap = await this.db.collection('tenants').doc(tid).collection('attendanceSessions').get();
      if (!tenantSnap.empty) {
        snap = tenantSnap;
      } else {
        snap = await this.db.collectionGroup('attendanceSessions').where('classSectionId', '==', classSectionIdOrTenantId).get();
      }
    } catch {
      snap = await this.db.collectionGroup('attendanceSessions').get();
    }
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async findSessionById(id: string): Promise<any | null> {
    const snap = await this.db.collectionGroup('attendanceSessions').where('id', '==', id).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    const sessionData = { id: doc.id, ...doc.data() };
    const attendancesSnap = await doc.ref.collection('attendances').get();
    return {
      ...sessionData,
      Attendance: attendancesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    };
  }

  async findAttendanceByStudent(studentId: string): Promise<any[]> {
    const snap = await this.db.collectionGroup('attendances').where('studentId', '==', studentId).get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async createSessionWithAttendance(sessionData: any, attendanceRecords: any[]): Promise<any> {
    const tenantId = sessionData.tenantId || 'tenant-test-001';
    const sessionRef = sessionData.id ? this.db.collection('tenants').doc(tenantId).collection('attendanceSessions').doc(sessionData.id) : this.db.collection('tenants').doc(tenantId).collection('attendanceSessions').doc();

    const batch = this.db.batch();
    const formattedSession = {
      ...sessionData,
      id: sessionRef.id,
      date: formatDateISO(sessionData.date),
      tenantId,
    };
    batch.set(sessionRef, formattedSession, { merge: true });

    if (attendanceRecords && attendanceRecords.length > 0) {
      attendanceRecords.forEach((rec) => {
        const attRef = rec.id ? sessionRef.collection('attendances').doc(rec.id) : sessionRef.collection('attendances').doc();
        batch.set(attRef, { ...rec, id: attRef.id, attendanceSessionId: sessionRef.id, tenantId }, { merge: true });
      });
    }

    await batch.commit();
    return formattedSession;
  }

  async updateAttendance(id: string, status: string, reason?: string): Promise<any> {
    const snap = await this.db.collectionGroup('attendances').where('id', '==', id).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    const payload: any = { status };
    if (reason !== undefined) payload.reason = reason;
    await doc.ref.set(payload, { merge: true });
    return { id, ...doc.data(), ...payload };
  }
}
