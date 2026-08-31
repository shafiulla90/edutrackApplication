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

  async findSessionsByClassSection(classSectionIdOrTenantId: string, startDate?: string, endDate?: string, tenantId?: string): Promise<any[]> {
    if (!classSectionIdOrTenantId) throw new Error('tenantId/classSectionId is required');
    const tid = tenantId || classSectionIdOrTenantId;
    let snap: FirebaseFirestore.QuerySnapshot;
    try {
      snap = await this.db.collection('tenants').doc(tid).collection('attendanceSessions').get();
      if (snap.empty) {
        snap = await this.db.collectionGroup('attendanceSessions').where('classSectionId', '==', classSectionIdOrTenantId).get();
      }
    } catch {
      snap = await this.db.collectionGroup('attendanceSessions').where('classSectionId', '==', classSectionIdOrTenantId).get();
    }
    return snap.docs
      .filter(doc => !tid || doc.data().tenantId === tid || doc.ref.path.includes(`tenants/${tid}/`))
      .map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async findSessionById(id: string, tenantId?: string): Promise<any | null> {
    if (tenantId) {
      const doc = await this.db.collection('tenants').doc(tenantId).collection('attendanceSessions').doc(id).get();
      if (doc.exists) {
        const sessionData = { id: doc.id, ...doc.data() };
        const attendancesSnap = await doc.ref.collection('attendances').get();
        return {
          ...sessionData,
          Attendance: attendancesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        };
      }
    }
    const snap = await this.db.collectionGroup('attendanceSessions').where('id', '==', id).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    const sessionData = { id: doc.id, ...doc.data() };
    if (tenantId && (sessionData as any).tenantId && (sessionData as any).tenantId !== tenantId) return null;
    const attendancesSnap = await doc.ref.collection('attendances').get();
    return {
      ...sessionData,
      Attendance: attendancesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    };
  }

  async findAttendanceByStudent(studentId: string, tenantId?: string): Promise<any[]> {
    if (tenantId) {
      const tenantSnap = await this.db.collection('tenants').doc(tenantId).collection('attendances').where('studentId', '==', studentId).get();
      if (!tenantSnap.empty) return tenantSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    }
    const snap = await this.db.collectionGroup('attendances').where('studentId', '==', studentId).get();
    return snap.docs
      .filter(doc => !tenantId || doc.data().tenantId === tenantId)
      .map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async createSessionWithAttendance(sessionData: any, attendanceRecords: any[]): Promise<any> {
    if (!sessionData.tenantId) throw new Error('tenantId is required');
    const tenantId = sessionData.tenantId;
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
