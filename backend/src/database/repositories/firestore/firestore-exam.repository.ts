import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase.service';
import { IExamRepository } from '../../../common/interfaces/exam.repository.interface';
import { DeterministicKey, formatDateISO } from '../../../common/utils/migration-helpers';

@Injectable()
export class FirestoreExamRepository implements IExamRepository {
  constructor(private readonly firebase: FirebaseService) {}

  private get db() {
    return this.firebase.getFirestore();
  }

  async findExamsByClassSection(classSectionId: string): Promise<any[]> {
    const snap = await this.db.collectionGroup('exams').where('classSectionId', '==', classSectionId).get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async findExamById(id: string): Promise<any | null> {
    const snap = await this.db.collectionGroup('exams').where('id', '==', id).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    const examData = { id: doc.id, ...doc.data() };
    const marksSnap = await doc.ref.collection('examMarks').get();
    return {
      ...examData,
      ExamMark: marksSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    };
  }

  async findMarksByExam(examId: string): Promise<any[]> {
    const snap = await this.db.collectionGroup('examMarks').where('examId', '==', examId).get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async findMarksByStudent(studentId: string): Promise<any[]> {
    const snap = await this.db.collectionGroup('examMarks').where('studentId', '==', studentId).get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async upsertExamMark(data: any): Promise<any> {
    const tenantId = data.tenantId || 'tenant-test-001';
    const docId = data.id || DeterministicKey.examMark(data.examId, data.studentId, data.subjectId);

    const examSnap = await this.db.collectionGroup('exams').where('id', '==', data.examId).limit(1).get();
    let examRef: FirebaseFirestore.DocumentReference;
    if (!examSnap.empty) {
      examRef = examSnap.docs[0].ref;
    } else {
      examRef = this.db.collection('tenants').doc(tenantId).collection('exams').doc(data.examId);
    }

    const markRef = examRef.collection('examMarks').doc(docId);
    const payload = {
      ...data,
      id: docId,
      marksObtained: Number(data.marksObtained),
      tenantId,
    };
    await markRef.set(payload, { merge: true });
    return payload;
  }

  async createExam(data: any): Promise<any> {
    const tenantId = data.tenantId || 'tenant-test-001';
    const ref = data.id ? this.db.collection('tenants').doc(tenantId).collection('exams').doc(data.id) : this.db.collection('tenants').doc(tenantId).collection('exams').doc();
    const payload = {
      ...data,
      id: ref.id,
      tenantId,
      createdAt: formatDateISO(data.createdAt || new Date()),
    };
    await ref.set(payload, { merge: true });
    return payload;
  }

  async findExamsByTenant(tenantId: string): Promise<any[]> {
    const snap = await this.db.collection('tenants').doc(tenantId).collection('exams').get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async createExamType(name: string, tenantId: string): Promise<any> {
    const ref = this.db.collection('tenants').doc(tenantId).collection('examTypes').doc();
    const payload = { id: ref.id, name, tenantId, createdAt: new Date().toISOString() };
    await ref.set(payload, { merge: true });
    return payload;
  }

  async updateExamType(id: string, name: string, tenantId: string): Promise<any> {
    const ref = this.db.collection('tenants').doc(tenantId).collection('examTypes').doc(id);
    await ref.set({ name, updatedAt: new Date().toISOString() }, { merge: true });
    const doc = await ref.get();
    return { id: doc.id, ...doc.data() };
  }

  async deleteExamType(id: string, tenantId: string): Promise<any> {
    const ref = this.db.collection('tenants').doc(tenantId).collection('examTypes').doc(id);
    await ref.delete();
    return { success: true, id };
  }

  async findExamTypesByTenant(tenantId: string): Promise<any[]> {
    const snap = await this.db.collection('tenants').doc(tenantId).collection('examTypes').get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }
}
