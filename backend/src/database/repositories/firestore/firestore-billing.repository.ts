import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase.service';
import { IBillingRepository } from '../../../common/interfaces/billing.repository.interface';
import { toCents, fromCents, formatDateISO } from '../../../common/utils/migration-helpers';

@Injectable()
export class FirestoreBillingRepository implements IBillingRepository {
  constructor(private readonly firebase: FirebaseService) {}

  private get db() {
    return this.firebase.getFirestore();
  }

  async findInvoicesByTenant(tenantId: string, status?: string): Promise<any[]> {
    let query: FirebaseFirestore.Query = this.db.collection('tenants').doc(tenantId).collection('invoices');
    if (status) query = query.where('status', '==', status);
    const snap = await query.get();
    return snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        totalAmount: data.totalAmountCents !== undefined ? fromCents(data.totalAmountCents) : Number(data.totalAmount || 0),
        paidAmount: data.paidAmountCents !== undefined ? fromCents(data.paidAmountCents) : Number(data.paidAmount || 0),
        remainingBalance: data.remainingBalanceCents !== undefined ? fromCents(data.remainingBalanceCents) : Number(data.remainingBalance || 0),
      };
    });
  }

  async findInvoiceById(id: string, tenantId?: string): Promise<any | null> {
    if (tenantId) {
      const doc = await this.db.collection('tenants').doc(tenantId).collection('invoices').doc(id).get();
      if (doc.exists) {
        const data = doc.data() || {};
        const itemsSnap = await doc.ref.collection('items').get();
        return {
          id: doc.id,
          ...data,
          totalAmount: data.totalAmountCents !== undefined ? fromCents(data.totalAmountCents) : Number(data.totalAmount || 0),
          paidAmount: data.paidAmountCents !== undefined ? fromCents(data.paidAmountCents) : Number(data.paidAmount || 0),
          remainingBalance: data.remainingBalanceCents !== undefined ? fromCents(data.remainingBalanceCents) : Number(data.remainingBalance || 0),
          InvoiceItem: itemsSnap.docs.map((itemDoc) => {
            const itemData = itemDoc.data();
            return {
              id: itemDoc.id,
              ...itemData,
              amount: itemData.amountCents !== undefined ? fromCents(itemData.amountCents) : Number(itemData.amount || 0),
            };
          }),
        };
      }
    }

    const snap = await this.db.collectionGroup('invoices').where('id', '==', id).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    const data = doc.data();
    const itemsSnap = await doc.ref.collection('items').get();

    return {
      id: doc.id,
      ...data,
      totalAmount: data.totalAmountCents !== undefined ? fromCents(data.totalAmountCents) : Number(data.totalAmount || 0),
      paidAmount: data.paidAmountCents !== undefined ? fromCents(data.paidAmountCents) : Number(data.paidAmount || 0),
      remainingBalance: data.remainingBalanceCents !== undefined ? fromCents(data.remainingBalanceCents) : Number(data.remainingBalance || 0),
      InvoiceItem: itemsSnap.docs.map((itemDoc) => {
        const itemData = itemDoc.data();
        return {
          id: itemDoc.id,
          ...itemData,
          amount: itemData.amountCents !== undefined ? fromCents(itemData.amountCents) : Number(itemData.amount || 0),
        };
      }),
    };
  }

  async findInvoicesByStudent(studentId: string): Promise<any[]> {
    const snap = await this.db.collectionGroup('invoices').where('studentId', '==', studentId).get();
    return snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        totalAmount: data.totalAmountCents !== undefined ? fromCents(data.totalAmountCents) : Number(data.totalAmount || 0),
        paidAmount: data.paidAmountCents !== undefined ? fromCents(data.paidAmountCents) : Number(data.paidAmount || 0),
        remainingBalance: data.remainingBalanceCents !== undefined ? fromCents(data.remainingBalanceCents) : Number(data.remainingBalance || 0),
      };
    });
  }

  async createInvoice(invoiceData: any, items: any[]): Promise<any> {
    if (!invoiceData.tenantId) throw new Error('tenantId is required');
    const tenantId = invoiceData.tenantId;
    const invRef = invoiceData.id ? this.db.collection('tenants').doc(tenantId).collection('invoices').doc(invoiceData.id) : this.db.collection('tenants').doc(tenantId).collection('invoices').doc();

    const batch = this.db.batch();
    const payload = {
      ...invoiceData,
      id: invRef.id,
      tenantId,
      totalAmountCents: toCents(invoiceData.totalAmount),
      paidAmountCents: toCents(invoiceData.paidAmount || 0),
      remainingBalanceCents: toCents(invoiceData.remainingBalance || invoiceData.totalAmount),
      invoiceDate: formatDateISO(invoiceData.invoiceDate),
      dueDate: formatDateISO(invoiceData.dueDate),
    };
    batch.set(invRef, payload, { merge: true });

    if (items && items.length > 0) {
      items.forEach((item) => {
        const itemRef = item.id ? invRef.collection('items').doc(item.id) : invRef.collection('items').doc();
        batch.set(itemRef, {
          ...item,
          id: itemRef.id,
          invoiceId: invRef.id,
          amountCents: toCents(item.amount),
          tenantId,
        }, { merge: true });
      });
    }

    await batch.commit();
    return payload;
  }

  async updateInvoiceStatus(id: string, status: string, paidAmount?: number): Promise<any> {
    const snap = await this.db.collectionGroup('invoices').where('id', '==', id).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    const data = doc.data();

    const updatePayload: any = { status };
    if (paidAmount !== undefined) {
      updatePayload.paidAmountCents = toCents(paidAmount);
      updatePayload.paidAmount = paidAmount;
      const totalCents = data.totalAmountCents !== undefined ? data.totalAmountCents : toCents(data.totalAmount || 0);
      updatePayload.remainingBalanceCents = Math.max(0, totalCents - toCents(paidAmount));
      updatePayload.remainingBalance = fromCents(updatePayload.remainingBalanceCents);
    }

    await doc.ref.set(updatePayload, { merge: true });
    return { id: doc.id, ...data, ...updatePayload };
  }

  async createPayment(paymentData: any): Promise<any> {
    if (!paymentData.tenantId) throw new Error('tenantId is required');
    const tenantId = paymentData.tenantId;
    const paymentAmount = Number(paymentData.amount || 0);
    const amountCents = toCents(paymentAmount);

    const ref = paymentData.id
      ? this.db.collection('tenants').doc(tenantId).collection('payments').doc(paymentData.id)
      : this.db.collection('tenants').doc(tenantId).collection('payments').doc();

    const payload = {
      ...paymentData,
      id: ref.id,
      tenantId,
      amount: paymentAmount,
      amountCents,
      createdAt: paymentData.createdAt || new Date().toISOString(),
    };

    await this.db.runTransaction(async (transaction) => {
      let invoiceRef: FirebaseFirestore.DocumentReference | null = null;
      let currentInvoiceData: any = null;
      if (paymentData.invoiceId) {
        invoiceRef = this.db.collection('tenants').doc(tenantId).collection('invoices').doc(paymentData.invoiceId);
        const invSnap = await transaction.get(invoiceRef);
        if (invSnap.exists) {
          currentInvoiceData = invSnap.data();
        }
      }

      let studentRef: FirebaseFirestore.DocumentReference | null = null;
      let currentStudentData: any = null;
      if (paymentData.studentId) {
        studentRef = this.db.collection('studentProfiles').doc(paymentData.studentId);
        const sSnap = await transaction.get(studentRef);
        if (sSnap.exists) {
          currentStudentData = sSnap.data();
        }
      }

      transaction.set(ref, payload, { merge: true });

      if (invoiceRef && currentInvoiceData) {
        const prevPaidCents = currentInvoiceData.paidAmountCents !== undefined ? currentInvoiceData.paidAmountCents : toCents(currentInvoiceData.paidAmount || 0);
        const totalCents = currentInvoiceData.totalAmountCents !== undefined ? currentInvoiceData.totalAmountCents : toCents(currentInvoiceData.totalAmount || 0);

        const newPaidCents = prevPaidCents + amountCents;
        const newRemainingCents = Math.max(0, totalCents - newPaidCents);
        const newStatus = newRemainingCents <= 0 ? 'PAID' : newPaidCents > 0 ? 'PARTIAL' : 'UNPAID';

        transaction.set(invoiceRef, {
          paidAmountCents: newPaidCents,
          paidAmount: fromCents(newPaidCents),
          remainingBalanceCents: newRemainingCents,
          remainingBalance: fromCents(newRemainingCents),
          status: newStatus,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }

      if (studentRef && currentStudentData) {
        const prevPaid = Number(currentStudentData.paidAmount || 0);
        const prevBalance = Number(currentStudentData.balanceDue || 0);

        transaction.set(studentRef, {
          paidAmount: prevPaid + paymentAmount,
          balanceDue: Math.max(0, prevBalance - paymentAmount),
          financialStatus: (prevBalance - paymentAmount) <= 0 ? 'Paid' : 'Partial',
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }
    });

    return payload;
  }

  async findPaymentById(id: string, tenantId?: string): Promise<any | null> {
    if (!tenantId) throw new Error('tenantId is required');
    const tid = tenantId;
    const doc = await this.db.collection('tenants').doc(tid).collection('payments').doc(id).get();
    if (doc.exists) return { id: doc.id, ...doc.data() };

    const snap = await this.db.collectionGroup('payments').where('id', '==', id).limit(1).get();
    if (!snap.empty && snap.docs[0].data()?.tenantId === tid) {
      return { id: snap.docs[0].id, ...snap.docs[0].data() };
    }
    return null;
  }

  async getRecentPayments(tenantId: string, limit = 50): Promise<any[]> {
    if (!tenantId) throw new Error('tenantId is required');
    const tid = tenantId;
    const snap = await this.db.collection('tenants').doc(tid).collection('payments').limit(limit).get();
    
    const studentIds = Array.from(new Set(snap.docs.map(doc => doc.data().studentId).filter(Boolean)));
    const studentMap = new Map<string, any>();

    if (studentIds.length > 0) {
      await Promise.all(
        studentIds.map(async (sid) => {
          try {
            const sDoc = await this.db.collection('studentProfiles').doc(sid).get();
            if (sDoc.exists) {
              const sData = sDoc.data() || {};
              let uData: any = null;
              if (sData.userId) {
                const uDoc = await this.db.collection('users').doc(sData.userId).get();
                if (uDoc.exists) uData = uDoc.data();
              }
              const sName = uData?.name || sData.name || sData.studentName || `${sData.firstName || ''} ${sData.lastName || ''}`.trim() || 'Student Record';
              studentMap.set(sid, {
                name: sName,
                rollNo: sData.rollNo || sData.rollNumber || 'STU-1844',
              });
            }
          } catch (err) {}
        })
      );
    }

    return snap.docs.map((doc) => {
      const data = doc.data();
      const sInfo = studentMap.get(data.studentId) || { name: 'Student Record', rollNo: 'STU-1844' };
      const amountVal = data.amountCents !== undefined ? fromCents(data.amountCents) : Number(data.amount || 0);
      const createdAtISO = data.createdAt || data.paymentDate || new Date().toISOString();
      const dateObj = new Date(createdAtISO);
      const dateStr = !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN');

      return {
        id: doc.id,
        ...data,
        amount: amountVal,
        totalAmount: amountVal,
        name: sInfo.name,
        studentName: sInfo.name,
        rollNo: sInfo.rollNo,
        dateStr,
        paymentDate: createdAtISO,
        status: data.status || 'SUCCESS',
        paymentMethod: data.paymentMethod || 'CASH',
      };
    });
  }

  async updateStudentLedger(tenantId: string, studentId: string, paidAmount: number, remainingBalance: number, status: string): Promise<void> {
    if (!studentId) return;
    try {
      const sRef = this.db.collection('studentProfiles').doc(studentId);
      await sRef.set({
        outstandingAmount: remainingBalance,
        totalPendingBalance: remainingBalance,
        totalPaidAmount: paidAmount,
        financialStatus: status,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (err) {
      console.warn('Failed to update student profile ledger in Firestore:', err);
    }
  }

  async findExpensesByTenant(tenantId: string): Promise<any[]> {
    const snap = await this.db.collection('tenants').doc(tenantId).collection('expenses').get();
    return snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        amount: data.amountCents !== undefined ? fromCents(data.amountCents) : Number(data.amount || 0),
      };
    });
  }

  async createExpense(data: any): Promise<any> {
    const tenantId = data.tenantId || 'tenant-test-001';
    const ref = data.id ? this.db.collection('tenants').doc(tenantId).collection('expenses').doc(data.id) : this.db.collection('tenants').doc(tenantId).collection('expenses').doc();
    const payload = {
      ...data,
      id: ref.id,
      tenantId,
      amountCents: toCents(data.amount),
      date: formatDateISO(data.date),
    };
    await ref.set(payload, { merge: true });
    return payload;
  }

  async updateExpense(id: string, data: any, tenantId?: string): Promise<any> {
    const tid = tenantId || data.tenantId || 'tenant-test-001';
    const ref = this.db.collection('tenants').doc(tid).collection('expenses').doc(id);
    const payload: any = {
      ...data,
      updatedAt: new Date().toISOString(),
    };
    if (data.amount !== undefined) {
      payload.amountCents = toCents(data.amount);
    }
    await ref.set(payload, { merge: true });
    const doc = await ref.get();
    return { id: doc.id, ...doc.data() };
  }

  async deleteExpense(id: string, tenantId?: string): Promise<any> {
    const tid = tenantId || 'tenant-test-001';
    const ref = this.db.collection('tenants').doc(tid).collection('expenses').doc(id);
    await ref.delete();
    return { success: true, id };
  }

  async createFeeProducts(productNames: string[], tenantId: string): Promise<any[]> {
    const tid = tenantId || 'tenant-test-001';
    const batch = this.db.batch();
    const created: any[] = [];
    for (const name of productNames || []) {
      if (!name || !name.toString().trim()) continue;
      const ref = this.db.collection('tenants').doc(tid).collection('feeProducts').doc();
      const payload = {
        id: ref.id,
        name: name.toString().trim(),
        tenantId: tid,
        createdAt: new Date().toISOString(),
      };
      batch.set(ref, payload, { merge: true });
      created.push(payload);
    }
    await batch.commit();
    return created;
  }

  async getAllFeeProducts(tenantId: string): Promise<any[]> {
    const tid = tenantId || 'tenant-test-001';
    const snap = await this.db.collection('tenants').doc(tid).collection('feeProducts').get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async updateFeeProduct(id: string, name: string, tenantId: string): Promise<any> {
    const tid = tenantId || 'tenant-test-001';
    const ref = this.db.collection('tenants').doc(tid).collection('feeProducts').doc(id);
    const payload = { name: name.trim(), updatedAt: new Date().toISOString() };
    await ref.set(payload, { merge: true });
    return { id, name, tenantId: tid };
  }

  async deleteFeeProduct(id: string, tenantId: string): Promise<any> {
    const tid = tenantId || 'tenant-test-001';
    const ref = this.db.collection('tenants').doc(tid).collection('feeProducts').doc(id);
    await ref.delete();
    return { id, success: true };
  }

  async savePriceBook(classId: string, academicYearId: string, priceItems: any[], tenantId: string): Promise<any> {
    const tid = tenantId || 'tenant-test-001';
    const batch = this.db.batch();
    const cleanItems = (priceItems || []).map((item) => {
      const ref = item.id ? this.db.collection('tenants').doc(tid).collection('priceBooks').doc(item.id) : this.db.collection('tenants').doc(tid).collection('priceBooks').doc();
      const payload = {
        id: ref.id,
        tenantId: tid,
        classId,
        academicYearId,
        productId: item.productId,
        price: Number(item.price || 0),
        selected: Boolean(item.selected),
        updatedAt: new Date().toISOString(),
      };
      batch.set(ref, payload, { merge: true });
      return payload;
    });
    await batch.commit();
    return { success: true, items: cleanItems };
  }

  async getPriceBook(classId: string, academicYearId: string, tenantId: string): Promise<any[]> {
    const tid = tenantId || 'tenant-test-001';
    let query: FirebaseFirestore.Query = this.db.collection('tenants').doc(tid).collection('priceBooks');
    if (classId) query = query.where('classId', '==', classId);
    if (academicYearId) query = query.where('academicYearId', '==', academicYearId);
    const snap = await query.get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }
}
