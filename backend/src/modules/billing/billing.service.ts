import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { IBillingRepository } from '../../common/interfaces/billing.repository.interface';
import { IAcademicRepository } from '../../common/interfaces/academic.repository.interface';
import { IStudentRepository } from '../../common/interfaces/student.repository.interface';
import { IUserRepository } from '../../common/interfaces/user.repository.interface';
import { randomUUID } from 'crypto';

function parseDocDate(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  if (typeof val === 'object') {
    if (typeof val._seconds === 'number') return new Date(val._seconds * 1000);
    if (typeof val.seconds === 'number') return new Date(val.seconds * 1000);
    if (typeof val.toDate === 'function') return val.toDate();
  }
  return new Date();
}

@Injectable()
export class BillingService {
  constructor(
    @Inject('IBillingRepository') private readonly billingRepo: IBillingRepository,
    @Inject('IAcademicRepository') private readonly academicRepo: IAcademicRepository,
    @Inject('IStudentRepository') private readonly studentRepo: IStudentRepository,
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
  ) {}

  async createFeeProducts(productNames: string[], tenantId?: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const tid = tenantId;
    if (this.billingRepo.createFeeProducts) {
      return this.billingRepo.createFeeProducts(productNames, tid);
    }
    return [];
  }

  async getAllFeeProducts(tenantId?: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const tid = tenantId;
    if (this.billingRepo.getAllFeeProducts) {
      return this.billingRepo.getAllFeeProducts(tid);
    }
    return [];
  }

  async updateFeeProduct(id: string, name: string, tenantId?: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const tid = tenantId;
    if (this.billingRepo.updateFeeProduct) {
      return this.billingRepo.updateFeeProduct(id, name, tid);
    }
    return { id, name };
  }

  async deleteFeeProduct(id: string, tenantId?: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const tid = tenantId;
    if (this.billingRepo.deleteFeeProduct) {
      return this.billingRepo.deleteFeeProduct(id, tid);
    }
    return { id, success: true };
  }

  async savePriceBook(classId: string, academicYearId: string, priceItems: any[], tenantId?: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const tid = tenantId;
    if (this.billingRepo.savePriceBook) {
      return this.billingRepo.savePriceBook(classId, academicYearId, priceItems, tid);
    }
    return { success: true, items: [] };
  }

  async getPriceBook(classId: string, academicYearId: string, tenantId?: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const tid = tenantId;
    if (this.billingRepo.getPriceBook) {
      return this.billingRepo.getPriceBook(classId, academicYearId, tid);
    }
    return [];
  }

  async createInvoice(invoiceData: any, items: any[], tenantId?: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const tid = tenantId;
    const studentId = invoiceData.studentId || invoiceData.opportunityId || 'std-1';

    // 1. Calculate amount paid in this transaction
    const transactionItems = items && items.length > 0 ? items : (invoiceData.items || []);
    const paymentAmount = transactionItems.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);

    // 2. Fetch student profile from Firestore
    let studentProfile: any = null;
    try {
      studentProfile = await this.studentRepo.findProfileById(studentId);
    } catch (err) {
      console.warn('Failed to fetch student profile for payment:', err);
    }

    const totalInvoiceAmount = Number(studentProfile?.netPayable || studentProfile?.netFeeTotal || studentProfile?.grossAmount || studentProfile?.totalFee || studentProfile?.totalAmount || invoiceData.totalAmount || 0);

    // 3. Check for existing invoices for this student in Firestore
    let existingInvoices: any[] = [];
    try {
      existingInvoices = await this.billingRepo.findInvoicesByStudent(studentId);
    } catch (err) {}

    let currentInvoice = existingInvoices.length > 0 ? existingInvoices[0] : null;
    const existingPaid = Number(currentInvoice?.paidAmount || 0);

    // Cumulative calculation
    const currentRemaining = Math.max(0, totalInvoiceAmount - existingPaid);
    if (currentRemaining <= 0) {
      throw new BadRequestException('Invoice for this student is already fully paid.');
    }
    if (paymentAmount > currentRemaining) {
      throw new BadRequestException(`Payment amount ₹${paymentAmount} exceeds remaining balance of ₹${currentRemaining}.`);
    }

    const newPaidAmount = existingPaid + paymentAmount;
    const newBalance = Math.max(0, totalInvoiceAmount - newPaidAmount);

    let newStatus = 'UNPAID';
    if (newPaidAmount >= totalInvoiceAmount) {
      newStatus = 'PAID';
    } else if (newPaidAmount > 0) {
      newStatus = 'PARTIALLY_PAID';
    }

    // 4. Save/Update Invoice Document in Firestore
    const invoicePayload = {
      id: currentInvoice?.id,
      tenantId: tid,
      studentId,
      studentName: studentProfile?.User?.name || studentProfile?.name || 'Student',
      totalAmount: totalInvoiceAmount,
      paidAmount: newPaidAmount,
      remainingBalance: newBalance,
      status: newStatus,
      paymentMethod: invoiceData.paymentMethod || 'CASH',
      invoiceDate: new Date().toISOString(),
    };

    const savedInvoice = await this.billingRepo.createInvoice(invoicePayload, transactionItems);
    const invoiceId = savedInvoice.id || currentInvoice?.id || 'inv-' + randomUUID();

    // 5. Create Payment Record in Firestore
    const receiptNumber = 'REC-' + Date.now().toString().slice(-6);
    const transactionId = 'TXN-' + randomUUID().substring(0, 8).toUpperCase();
    const paymentPayload = {
      id: transactionId,
      receiptNumber,
      transactionId,
      invoiceId,
      studentId,
      tenantId: tid,
      amount: paymentAmount,
      paymentMethod: invoiceData.paymentMethod || 'CASH',
      bankDetails: invoiceData.bankDetails || null,
      items: transactionItems,
      paymentDate: new Date().toISOString(),
      status: 'SUCCESS',
      createdAt: new Date().toISOString(),
    };

    if ((this.billingRepo as any).createPayment) {
      await (this.billingRepo as any).createPayment(paymentPayload);
    }

    if ((this.billingRepo as any).updateStudentLedger && studentId) {
      await (this.billingRepo as any).updateStudentLedger(tid, studentId, newPaidAmount, newBalance, newStatus);
    }

    return {
      id: transactionId,
      invoiceId,
      studentId,
      amount: paymentAmount,
      totalPaid: newPaidAmount,
      remainingBalance: newBalance,
      invoiceStatus: newStatus,
      receiptNumber,
      transactionId,
      status: 'SUCCESS',
      invoice: savedInvoice,
    };
  }

  async getRecentInvoices(studentId?: string, tenantId?: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const tid = tenantId;
    let payments: any[] = [];
    if ((this.billingRepo as any).getRecentPayments) {
      payments = await (this.billingRepo as any).getRecentPayments(tid);
    }
    if (!payments || payments.length === 0) {
      if (studentId) {
        return this.billingRepo.findInvoicesByStudent(studentId);
      }
      return this.billingRepo.findInvoicesByTenant(tid);
    }
    return payments;
  }

  async getInvoiceDetails(invoiceId: string, tenantId?: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const tid = tenantId;
    let invoice: any = null;
    let payment: any = null;

    try {
      invoice = await this.billingRepo.findInvoiceById(invoiceId, tid);
    } catch (err) {}

    if ((this.billingRepo as any).findPaymentById) {
      try {
        payment = await (this.billingRepo as any).findPaymentById(invoiceId, tid);
        if (payment && !invoice) {
          invoice = await this.billingRepo.findInvoiceById(payment.invoiceId, tid);
        }
      } catch (err) {}
    }

    if (!invoice && !payment) {
      throw new NotFoundException(`Invoice or Payment with ID '${invoiceId}' not found.`);
    }

    return {
      id: invoiceId,
      invoiceNo: payment?.receiptNumber || invoice?.invoiceNo || invoiceId,
      totalAmount: invoice?.totalAmount || payment?.amount || 0,
      paidAmount: payment?.amount || invoice?.paidAmount || 0,
      remainingBalance: invoice?.remainingBalance !== undefined ? invoice.remainingBalance : 0,
      status: invoice?.status || 'UNPAID',
      items: payment?.items || invoice?.InvoiceItem || [],
    };
  }

  async getInvoicePDFData(invoiceId: string, tenantId?: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const tid = tenantId;
    let invoice: any = null;
    let payment: any = null;

    try {
      invoice = await this.billingRepo.findInvoiceById(invoiceId);
    } catch (err) {}

    if ((this.billingRepo as any).findPaymentById) {
      try {
        payment = await (this.billingRepo as any).findPaymentById(invoiceId, tid);
        if (payment && !invoice) {
          invoice = await this.billingRepo.findInvoiceById(payment.invoiceId);
        }
      } catch (err) {}
    }

    const studentId = invoice?.studentId || payment?.studentId || 'std-1';
    let profile: any = null;
    if (this.studentRepo && studentId) {
      try {
        profile = await this.studentRepo.findProfileById(studentId);
      } catch (err) {}
    }

    let tenant: any = null;
    try {
      const db = (this.billingRepo as any)?.db;
      if (db) {
        const tDoc = await db.collection('tenants').doc(tid).get();
        if (tDoc && tDoc.exists) tenant = tDoc.data();
      }
    } catch (e) {}

    const schoolName = tenant?.name || 'A.P. GREENWOOD HIGH SCHOOL';
    const schoolSubtitle = tenant?.tagline || 'Excellence in Education & Character Building';
    const studentName = profile?.User?.name || profile?.name || 'Student Record';
    const fatherName = profile?.fatherName || 'N/A';
    const motherName = profile?.motherName || 'N/A';
    const parentPhone = profile?.parentPhone || profile?.fatherPhone || profile?.motherPhone || profile?.User?.phone || profile?.phone || profile?.mobileNumber || payment?.parentPhone || invoice?.parentPhone || null;
    const fatherPhone = profile?.fatherPhone || null;
    const motherPhone = profile?.motherPhone || null;

    const className = profile?.className || profile?.class || 'Class 1';
    const sectionName = profile?.sectionName || profile?.section || 'A';
    const rollNo = profile?.rollNo || 'STU-1001';

    const invoiceNo = payment?.receiptNumber || invoice?.invoiceNo || invoiceId.slice(0, 10).toUpperCase();
    const currentPayment = Number(payment?.amount || invoice?.paidAmount || 2500);

    let totalPaidAll = 0;
    try {
      const snap = await (this.billingRepo as any).db
        .collection('tenants')
        .doc(tid)
        .collection('payments')
        .where('studentId', '==', studentId)
        .get();

      if (!snap.empty) {
        totalPaidAll = snap.docs.reduce((sum: number, doc: any) => {
          const d = doc.data();
          if (d.status === 'SUCCESS' || !d.status) {
            const amt = d.amountCents !== undefined ? d.amountCents / 100 : Number(d.amount || 0);
            return sum + amt;
          }
          return sum;
        }, 0);
      }
    } catch (err) {}

    if (totalPaidAll <= 0) {
      totalPaidAll = currentPayment;
    }

    const totalFeeAmount = Number(profile?.netPayable || profile?.netFeeTotal || profile?.grossAmount || profile?.totalFee || 0);
    const previouslyPaid = Math.max(0, totalPaidAll - currentPayment);
    const remainingBalance = Math.max(0, totalFeeAmount - totalPaidAll);

    // Compute fee item level breakdown
    const baseFeeItems = [
      { particulars: 'Tuition Fee', totalAmount: 5000 },
      { particulars: 'Admission & Admin Fee', totalAmount: 2500 },
      { particulars: 'Transport / Van Fee', totalAmount: 5000 },
      { particulars: 'Activity & Sports Fee', totalAmount: 2500 },
    ];

    let remPrev = previouslyPaid;
    let remCurr = currentPayment;

    const detailedItems = baseFeeItems.map((item) => {
      const itemPrevPaid = Math.min(item.totalAmount, remPrev);
      remPrev -= itemPrevPaid;

      const itemCurrBal = item.totalAmount - itemPrevPaid;
      const itemCurrPaid = Math.min(itemCurrBal, remCurr);
      remCurr -= itemCurrPaid;

      const itemRemBal = item.totalAmount - itemPrevPaid - itemCurrPaid;

      return {
        particulars: item.particulars,
        totalAmount: item.totalAmount,
        previouslyPaid: itemPrevPaid,
        currentPayment: itemCurrPaid,
        remainingBalance: itemRemBal,
        amount: itemCurrPaid > 0 ? itemCurrPaid : item.totalAmount,
      };
    });

    return {
      schoolName,
      schoolSubtitle,
      schoolLogo: tenant?.logoUrl || '',
      schoolAddress: tenant?.address || 'Vikas Nagar, Delhi, India',
      schoolPhone: tenant?.phone || tenant?.adminPhone || '+91 9876543210',
      invoiceNo,
      invoiceDate: payment?.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN'),
      academicYear: '2026-2027',
      admissionRef: rollNo,
      studentName,
      fatherName,
      motherName,
      parentPhone,
      fatherPhone,
      motherPhone,
      className,
      sectionName,
      studentDob: profile?.dob || '15 May 2012',
      addressVillage: profile?.address || 'Plot No. 12, Vikas Nagar, New Delhi - 110009',
      totalFeeAmount,
      totalDiscount: 0,
      previouslyPaid,
      currentPayment,
      paidAmount: currentPayment,
      remainingBalance,
      totalAmount: currentPayment,
      invoiceTotal: totalFeeAmount,
      items: detailedItems,
    };
  }

  async getActiveProducts(classId: string, academicYearId?: string, tenantId?: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const tid = tenantId;
    let products: any[] = [];
    if (this.billingRepo.getAllFeeProducts) {
      products = await this.billingRepo.getAllFeeProducts(tid);
    }

    let priceMap: Record<string, number> = {};
    let selectedSet = new Set<string>();
    let hasPriceBook = false;

    if (classId && this.billingRepo.getPriceBook) {
      try {
        const pb = await this.billingRepo.getPriceBook(classId, academicYearId || '', tid);
        if (Array.isArray(pb) && pb.length > 0) {
          hasPriceBook = true;
          pb.forEach((item: any) => {
            if (item.productId && item.selected !== false) {
              selectedSet.add(item.productId);
              if (item.price !== undefined) {
                priceMap[item.productId] = Number(item.price);
              }
            }
          });
        }
      } catch (err) {
        // Ignore pricebook query errors
      }
    }

    if (!products || products.length === 0) {
      return [];
    }

    // Filter products configured for this class if Price Book exists
    const available = hasPriceBook
      ? products.filter((p) => selectedSet.has(p.id))
      : products;

    return available.map((p) => {
      const price = priceMap[p.id] !== undefined
        ? priceMap[p.id]
        : Number(p.unitPrice ?? p.price ?? 0);
      return {
        ...p,
        id: p.id,
        productName: p.productName || p.name || 'Fee Item',
        name: p.name || p.productName || 'Fee Item',
        unitPrice: price,
        price: price,
      };
    });
  }

  async createAdmission(studentData: any, selectedPricebookEntryIds: string[], concessionAmount: number, tenantId?: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const tid = tenantId;
    const userId = randomUUID();
    const studentProfileId = randomUUID();

    const fullName = `${studentData?.firstName || ''} ${studentData?.lastName || ''}`.trim() || 'New Student';
    const rollNo = 'STU-' + Math.floor(1000 + Math.random() * 9000);
    const classId = studentData?.classId || studentData?.selectedClass || null;
    const academicYearId = studentData?.academicYearId || studentData?.academicYear || null;

    // Fetch active products for student's class
    let activeProducts: any[] = [];
    if (classId) {
      try {
        activeProducts = await this.getActiveProducts(classId, academicYearId || '', tid);
      } catch (e) {}
    }

    // Filter selected products
    let selectedProducts = activeProducts;
    if (Array.isArray(selectedPricebookEntryIds) && selectedPricebookEntryIds.length > 0) {
      selectedProducts = activeProducts.filter((p) => selectedPricebookEntryIds.includes(p.id));
    }

    const grossAmount = selectedProducts.reduce((sum, p) => sum + Number(p.unitPrice ?? p.price ?? 0), 0);
    const discountVal = Number(concessionAmount || 0);
    const netPayable = Math.max(0, grossAmount - discountVal);

    // Build fee allocation items
    const feeAllocationItems = selectedProducts.map((p, idx) => ({
      id: `fa-${p.id}-${Date.now()}-${idx}`,
      productId: p.id,
      productName: p.productName || p.name || 'Fee Product',
      configuredAmount: Number(p.unitPrice ?? p.price ?? 0),
      allocatedAmount: Number(p.unitPrice ?? p.price ?? 0),
      discountAmount: 0,
      paidAmount: 0,
      balanceDue: Number(p.unitPrice ?? p.price ?? 0),
      createdAt: new Date().toISOString(),
    }));

    // 1. Create Student User Record
    if (this.userRepo) {
      await this.userRepo.create({
        id: userId,
        email: studentData?.email || `student_${Date.now()}@school.com`,
        name: fullName,
        phone: studentData?.phone || null,
        role: 'STUDENT',
        isActive: true,
        tenantId: tid,
      }).catch(() => {});
    }

    // 2. Create Student Profile Record with Fee Ledger Summary
    let studentProfile: any = null;
    if (this.studentRepo) {
      studentProfile = await this.studentRepo.createProfile({
        id: studentProfileId,
        userId,
        tenantId: tid,
        firstName: studentData?.firstName || null,
        lastName: studentData?.lastName || null,
        name: fullName,
        rollNo,
        classId,
        sectionId: studentData?.sectionId || studentData?.selectedSection || null,
        academicYearId,
        dob: studentData?.dob || null,
        gender: studentData?.gender || null,
        fatherName: studentData?.fatherName || studentData?.parentName || null,
        motherName: studentData?.motherName || null,
        parentName: studentData?.parentName || studentData?.fatherName || null,
        parentPhone: studentData?.parentPhone || studentData?.phone || null,
        parentEmail: studentData?.parentEmail || studentData?.email || null,
        address: studentData?.address || `${studentData?.village || ''} ${studentData?.city || ''}`.trim() || null,
        status: 'Active',
        financialStatus: 'Pending',
        profilePhotoUrl: studentData?.profilePhotoUrl || null,
        grossAmount,
        discountAmount: discountVal,
        netPayable,
        totalFeeAmount: netPayable,
        totalFees: netPayable,
        paidAmount: 0,
        outstandingAmount: netPayable,
        createdAt: new Date().toISOString(),
      });
    }

    // 3. Save Fee Allocation Subcollection in Firestore
    const db = (this.billingRepo as any)?.db;
    if (db && feeAllocationItems.length > 0) {
      try {
        const batch = db.batch();
        for (const item of feeAllocationItems) {
          const itemRef = db.collection('tenants').doc(tid).collection('students').doc(studentProfileId).collection('feeAllocation').doc(item.id);
          batch.set(itemRef, { ...item, tenantId: tid }, { merge: true });
        }
        await batch.commit();
      } catch (e) {
        console.error('Failed to save feeAllocation items:', e);
      }
    }

    return {
      success: true,
      message: 'Admission registered successfully',
      opportunityId: studentProfileId,
      studentId: studentProfileId,
      studentData,
      tenantId: tid,
      grossAmount,
      discountAmount: discountVal,
      netPayable,
      outstandingAmount: netPayable,
    };
  }

  async updateLineItemDiscount(oliId: string, discountPercent: number) {
    return { success: true, oliId, discountPercent };
  }

  async updateBulkLineItemDiscounts(oliIds: string[], discountPercent: number) {
    return { success: true, oliIds, discountPercent };
  }

  async getYearsOptions(tenantId?: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const tid = tenantId;
    try {
      const years = await this.academicRepo.findAcademicYears(tid);
      if (years && years.length > 0) {
        return years.map(y => ({ value: y.id, label: y.name }));
      }
    } catch (err) {
      // Fallback
    }
    return [
      { value: 'ay-2026', label: '2026-2027' },
      { value: 'ay-2025', label: '2025-2026' }
    ];
  }

  async getClassesOptions(tenantId?: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const tid = tenantId;
    try {
      const classes = await this.academicRepo.findClasses(tid);
      if (classes && classes.length > 0) {
        return classes.map(c => ({ value: c.id, label: c.name }));
      }
    } catch (err) {
      // Fallback
    }
    return [
      { value: 'class-1', label: 'Grade 1' },
      { value: 'class-2', label: 'Grade 2' },
      { value: 'class-3', label: 'Grade 3' },
      { value: 'class-4', label: 'Grade 4' },
      { value: 'class-5', label: 'Grade 5' },
      { value: 'class-6', label: 'Grade 6' },
      { value: 'class-7', label: 'Grade 7' },
      { value: 'class-8', label: 'Grade 8' },
      { value: 'class-9', label: 'Grade 9' },
      { value: 'class-10', label: 'Grade 10' }
    ];
  }

  async getSectionsOptions(classId?: string, tenantId?: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const tid = tenantId;
    try {
      const sections = await this.academicRepo.findSections(tid);
      if (sections && sections.length > 0) {
        return sections.map(s => ({ value: s.id, label: s.name }));
      }
    } catch (err) {
      // Fallback
    }
    return [
      { value: 'sec-a', label: 'Section A' },
      { value: 'sec-b', label: 'Section B' },
      { value: 'sec-c', label: 'Section C' }
    ];
  }

  async searchStudents(searchTerm: string, tenantId?: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const tid = tenantId;
    const q = (searchTerm || '').trim().toLowerCase();

    let students: any[] = [];
    try {
      const res: any = await this.studentRepo.findStudentsByTenant(tid, 1, 500, { search: q });
      students = Array.isArray(res) ? res : (res?.items || []);
    } catch (err) {
      console.warn('[searchStudents] Error fetching students:', err);
    }

    const filtered = !q ? students : students.filter((s) => {
      const name = (s.User?.name || s.name || s.studentName || `${s.firstName || ''} ${s.lastName || ''}`).toLowerCase();
      const rollNo = (s.rollNo || s.rollNumber || '').toLowerCase();
      const phone = (s.User?.phone || s.phone || s.mobileNumber || s.contact || '').toLowerCase();
      const email = (s.User?.email || s.email || '').toLowerCase();
      const fatherName = (s.fatherName || s.parentName || '').toLowerCase();
      const motherName = (s.motherName || '').toLowerCase();
      const aadharNo = (s.aadharNo || s.aadhar || '').toLowerCase();
      const className = (s.classSection?.class?.name || s.className || s.class || '').toLowerCase();
      const sectionName = (s.classSection?.section?.name || s.sectionName || s.section || '').toLowerCase();

      return (
        name.includes(q) ||
        rollNo.includes(q) ||
        phone.includes(q) ||
        email.includes(q) ||
        fatherName.includes(q) ||
        motherName.includes(q) ||
        aadharNo.includes(q) ||
        className.includes(q) ||
        sectionName.includes(q)
      );
    });

    const enriched = await Promise.all(
      filtered.map(async (s) => {
        let totalPaidFromPayments = 0;
        try {
          const snap = await (this.billingRepo as any).db
            .collection('tenants')
            .doc(tid)
            .collection('payments')
            .where('studentId', '==', s.id)
            .get();

          if (!snap.empty) {
            totalPaidFromPayments = snap.docs.reduce((sum: number, doc: any) => {
              const d = doc.data();
              if (d.status === 'SUCCESS' || !d.status) {
                const amt = d.amountCents !== undefined ? d.amountCents / 100 : Number(d.amount || 0);
                return sum + amt;
              }
              return sum;
            }, 0);
          }
        } catch (e) {}

        const netPayable = Number(s.netPayable || s.netFeeTotal || (Number(s.grossAmount || 0) - Number(s.discountAmount || 0)) || 0);
        let outstanding = Math.max(0, netPayable - totalPaidFromPayments);
        if (totalPaidFromPayments === 0) {
          let invs: any[] = [];
          try {
            invs = await this.billingRepo.findInvoicesByStudent(s.id);
          } catch (e) {}
          if (invs.length > 0 && invs[0].remainingBalance !== undefined) {
            outstanding = invs[0].remainingBalance;
          }
        }

        return this.formatStudentForBilling({
          ...s,
          outstandingAmount: outstanding,
          totalDue: outstanding,
        });
      }),
    );

    return enriched;
  }

  private formatStudentForBilling(s: any) {
    const name = s.User?.name || s.name || s.studentName || `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Student Record';
    const parentPhone = s.parentPhone || s.fatherPhone || s.motherPhone || s.User?.phone || s.phone || s.mobileNumber || s.contact || 'N/A';
    const phone = parentPhone;
    const email = s.User?.email || s.email || 'N/A';
    const className = s.classSection?.class?.name || s.className || s.class || 'Class 1';
    const sectionName = s.classSection?.section?.name || s.sectionName || s.section || 'A';
    const studentId = s.id || randomUUID();

    const gross = Number(s.grossAmount || s.totalFee || s.totalFees || s.allocatedAmount || 0);
    const discount = Number(s.discountAmount || s.concessionAmount || 0);
    const netPayable = s.netPayable !== undefined ? Number(s.netPayable) : (gross > 0 ? Math.max(0, gross - discount) : 0);

    const paidAmount = Number(s.totalPaidFromPayments ?? s.paidAmount ?? 0);
    const currentYearDue = s.outstandingAmount !== undefined ? Number(s.outstandingAmount) : (netPayable > 0 ? Math.max(0, netPayable - paidAmount) : 0);
    const previousYearDue = Number(s.previousYearDue || 0);
    const grandTotalDue = currentYearDue + previousYearDue;

    return {
      id: studentId,
      studentId,
      name,
      studentName: name,
      rollNo: s.rollNo || 'STU-1001',
      phone,
      parentPhone,
      fatherPhone: s.fatherPhone || null,
      motherPhone: s.motherPhone || null,
      email,
      fatherName: s.fatherName || 'N/A',
      motherName: s.motherName || 'N/A',
      class: className,
      className,
      section: sectionName,
      sectionName,
      classSection: `${className} - ${sectionName}`,
      grossAmount: gross,
      discountAmount: discount,
      netPayable,
      outstandingAmount: currentYearDue,
      currentYearDue,
      previousYearDue,
      grandTotalDue,
      totalDue: grandTotalDue,
      totalPendingBalance: currentYearDue,
      totalPaidAmount: paidAmount,
      status: 'Active',
      feeSummary: {
        currentYear: {
          feeProductsAmount: netPayable > 0 ? netPayable : gross,
          paidAmount: paidAmount,
          pendingAmount: currentYearDue,
        },
        previousYears: previousYearDue > 0 ? [
          { academicYearName: '2025-2026', outstandingBalance: previousYearDue }
        ] : [],
        overall: {
          totalCurrentYearDue: currentYearDue,
          totalPreviousYearDue: previousYearDue,
          grandTotalBalanceDue: grandTotalDue,
        }
      },
      account: {
        id: studentId,
        name,
        rollNo: s.rollNo || 'STU-1001',
        phone,
        parentPhone,
        fatherPhone: s.fatherPhone || null,
        motherPhone: s.motherPhone || null,
        fatherName: s.fatherName || 'N/A',
        motherName: s.motherName || 'N/A',
        className,
        sectionName,
        opportunities: [
          {
            id: studentId,
            name: 'Annual Tuition & Admission Ledger',
            academicYearId: s.academicYearId || 'ay-2026',
            amount: netPayable > 0 ? netPayable : gross,
            stage: 'Issued',
          }
        ]
      }
    };
  }

  async getStudentBillingAccount(studentId: string, tenantId?: string) {
    const tid = (tenantId && tenantId !== 'undefined' && tenantId !== 'null') ? tenantId : '';
    if (!tid) return null;
    let profile: any = null;
    try {
      profile = await this.studentRepo.findProfileById(studentId);
    } catch (err) {
      console.warn('[getStudentBillingAccount] Notice:', err);
    }

    if (!profile) {
      profile = {
        id: studentId,
        name: 'Student Record',
        rollNo: 'STU-1001',
        phone: 'N/A',
        fatherName: 'N/A',
        motherName: 'N/A',
        classSection: { class: { name: 'Class 1' }, section: { name: 'A' } }
      };
    }

    let totalPaidFromPayments = 0;
    const db = (this.billingRepo as any)?.db;
    if (db) {
      try {
        const snap = await db
          .collection('tenants')
          .doc(tid)
          .collection('payments')
          .where('studentId', '==', studentId)
          .get();

        if (!snap.empty) {
          totalPaidFromPayments = snap.docs.reduce((sum: number, doc: any) => {
            const d = doc.data();
            if (d.status === 'SUCCESS' || !d.status) {
              const amt = d.amountCents !== undefined ? d.amountCents / 100 : Number(d.amount || 0);
              return sum + amt;
            }
            return sum;
          }, 0);
        }
      } catch (err) {}
    }

    const netPayable = Number(profile.netPayable || profile.netFeeTotal || (Number(profile.grossAmount || 0) - Number(profile.discountAmount || 0)) || 0);
    const outstanding = Math.max(0, netPayable - totalPaidFromPayments);

    profile.totalPaidFromPayments = totalPaidFromPayments;
    profile.outstandingAmount = outstanding;

    const formatted = this.formatStudentForBilling(profile);
    return {
      ...formatted,
      account: formatted.account,
      student: formatted
    };
  }

  async getUnpaidFees(oppId: string, tenantId?: string) {
    const tid = (tenantId && tenantId !== 'undefined' && tenantId !== 'null') ? tenantId : '';
    if (!tid) return [];
    const studentId = oppId;
    const db = (this.billingRepo as any)?.db;

    let items: any[] = [];

    // 1. Check student's actual feeAllocation subcollection
    if (db) {
      try {
        const faSnap = await db.collection('tenants').doc(tid).collection('students').doc(studentId).collection('feeAllocation').get();
        if (!faSnap.empty) {
          items = faSnap.docs.map((doc: any) => {
            const d = doc.data();
            const total = Number(d.allocatedAmount ?? d.configuredAmount ?? d.totalAmount ?? 0);
            return {
              oliId: doc.id,
              productName: d.productName || 'Fee Product',
              productId: d.productId || doc.id,
              totalAmount: total,
              discountAmount: Number(d.discountAmount || 0),
              paidAmount: 0,
              balanceDue: total,
              discountPercent: 0,
            };
          });
        }
      } catch (e) {}
    }

    // 2. If no student-specific feeAllocation subcollection, check Class Price Book
    if (items.length === 0 && db) {
      try {
        const studentDoc = await db.collection('tenants').doc(tid).collection('students').doc(studentId).get();
        if (studentDoc.exists) {
          const s = studentDoc.data();
          if (s.classId) {
            const pbProducts = await this.getActiveProducts(s.classId, s.academicYearId, tid);
            items = pbProducts.map((p) => {
              const price = Number(p.unitPrice ?? p.price ?? 0);
              return {
                oliId: `oli-${p.id}`,
                productName: p.productName || p.name || 'Fee Item',
                productId: p.id,
                totalAmount: price,
                discountAmount: 0,
                paidAmount: 0,
                balanceDue: price,
                discountPercent: 0,
              };
            });
          }
        }
      } catch (e) {}
    }

    if (items.length === 0) {
      return [];
    }

    // 3. Apply payments made for this student
    let paidAmount = 0;
    if (db) {
      try {
        const snap = await db
          .collection('tenants')
          .doc(tid)
          .collection('payments')
          .where('studentId', '==', studentId)
          .get();

        if (!snap.empty) {
          paidAmount = snap.docs.reduce((sum: number, doc: any) => {
            const d = doc.data();
            if (d.status === 'SUCCESS' || !d.status) {
              const amt = d.amountCents !== undefined ? d.amountCents / 100 : Number(d.amount || 0);
              return sum + amt;
            }
            return sum;
          }, 0);
        }
      } catch (err) {}
    }

    if (paidAmount <= 0) {
      return items;
    }

    let remainingToDeduct = paidAmount;
    return items.map((item) => {
      const itemDeduct = Math.min(item.totalAmount, remainingToDeduct);
      remainingToDeduct -= itemDeduct;
      const newPaid = itemDeduct;
      const newBalance = Math.max(0, item.totalAmount - newPaid);
      return {
        ...item,
        paidAmount: newPaid,
        balanceDue: newBalance,
      };
    });
  }

  async getFinancialCommandCenter(tenantId: string, params?: any) {
    if (!tenantId) throw new Error('tenantId is required');
    const tid = tenantId;

    let years: any[] = [];
    let classes: any[] = [];
    let sections: any[] = [];

    try {
      years = (await this.academicRepo.findAcademicYears(tid)) || [];
      classes = (await this.academicRepo.findClasses(tid)) || [];
      sections = (await this.academicRepo.findSections(tid)) || [];
    } catch (err) {}

    let payments: any[] = [];
    let invoices: any[] = [];
    let expenses: any[] = [];

    try {
      payments = (await this.billingRepo.findPaymentsByTenant(tid)) || [];
      invoices = (await this.billingRepo.findInvoicesByTenant(tid)) || [];
      expenses = (await this.billingRepo.findExpensesByTenant(tid)) || [];
    } catch (err) {}

    // Apply Filter Parameters dynamically
    if (params) {
      if (params.academicYearId) {
        invoices = invoices.filter((i: any) => i.academicYearId === params.academicYearId);
        payments = payments.filter((p: any) => p.academicYearId === params.academicYearId);
      }
      if (params.classId) {
        invoices = invoices.filter((i: any) => i.classId === params.classId || i.className?.toLowerCase().includes(params.classId.toLowerCase()));
        payments = payments.filter((p: any) => p.classId === params.classId);
      }
      if (params.sectionId) {
        invoices = invoices.filter((i: any) => i.sectionId === params.sectionId || i.sectionName?.toLowerCase().includes(params.sectionId.toLowerCase()));
        payments = payments.filter((p: any) => p.sectionId === params.sectionId);
      }
      if (params.month) {
        const mNum = Number(params.month) - 1;
        invoices = invoices.filter((i: any) => {
          const d = new Date(i.invoiceDate || i.createdAt);
          return !isNaN(d.getTime()) && d.getMonth() === mNum;
        });
        payments = payments.filter((p: any) => {
          const d = new Date(p.paymentDate || p.createdAt);
          return !isNaN(d.getTime()) && d.getMonth() === mNum;
        });
        expenses = expenses.filter((e: any) => {
          const d = new Date(e.date || e.createdAt);
          return !isNaN(d.getTime()) && d.getMonth() === mNum;
        });
      }
      if (params.paymentMethod) {
        payments = payments.filter((p: any) => (p.paymentMethod || '').toUpperCase() === params.paymentMethod.toUpperCase());
      }
    }

    const now = new Date();
    const currentMo = now.getMonth();
    const currentYr = now.getFullYear();

    let currentMonthRevenue = 0;
    let currentMonthInvoicesCount = 0;
    let prevMonthRevenue = 0;
    let prevMonthInvoicesCount = 0;
    let yearRevenue = 0;

    const latestPayments: any[] = [];
    payments.forEach((p: any) => {
      const amt = p.amountCents !== undefined ? p.amountCents / 100 : Number(p.amount || 0);
      const dt = parseDocDate(p.paymentDate || p.createdAt);
      if (dt.getFullYear() === currentYr) {
        yearRevenue += amt;
        if (dt.getMonth() === currentMo) {
          currentMonthRevenue += amt;
          currentMonthInvoicesCount++;
        } else if (dt.getMonth() === currentMo - 1 || (currentMo === 0 && dt.getMonth() === 11 && dt.getFullYear() === currentYr - 1)) {
          prevMonthRevenue += amt;
          prevMonthInvoicesCount++;
        }
      }

      latestPayments.push({
        id: p.id || `PAY-${Math.random().toString(36).substring(2, 7)}`,
        studentName: p.studentName || p.name || 'Student',
        amount: amt,
        date: dt.toISOString(),
        method: p.paymentMethod || 'CASH',
      });
    });

    // Query studentProfiles for tenant to map student details & class
    const db = (this.billingRepo as any).db || (this.academicRepo as any).db;
    let studentProfilesSnap: any = null;
    if (db) {
      studentProfilesSnap = await db.collection('studentProfiles').where('tenantId', '==', tid).get().catch(() => null);
    }
    const studentProfilesMap = new Map<string, any>();
    if (studentProfilesSnap && !studentProfilesSnap.empty) {
      studentProfilesSnap.docs.forEach((doc: any) => {
        const d = doc.data();
        const sId = doc.id;
        const uId = d.userId;
        const name = d.name || (d.user?.name) || `${d.firstName || ''} ${d.lastName || ''}`.trim() || 'Student';
        const clsName = d.className || d.class || (d.classSection?.class?.name) || 'Class-1';
        const secName = d.sectionName || d.section || (d.classSection?.section?.name) || 'Section A';
        const rollNo = d.rollNo || 'STU-1001';

        const obj = { id: sId, userId: uId, name, className: clsName, sectionName: secName, rollNo };
        studentProfilesMap.set(sId, obj);
        if (uId) studentProfilesMap.set(uId, obj);
      });
    }

    let pendingTotal = 0;
    const studentDuesMap = new Map<string, any>();

    invoices.forEach((inv: any) => {
      const sId = inv.studentId || inv.id;
      const sInfo = studentProfilesMap.get(sId) || studentProfilesMap.get(inv.userId) || {};
      const sName = inv.studentName || sInfo.name || 'Student';
      const cName = inv.className || sInfo.className || 'Class-1';
      const secName = inv.sectionName || sInfo.sectionName || 'Section A';
      const rem = Number(inv.remainingBalance !== undefined ? inv.remainingBalance : (inv.balanceDue || 0));
      const tot = Number(inv.totalAmount || inv.amount || 0);
      const paid = Number(inv.paidAmount || 0);

      const uniqueKey = sInfo.id || sId;

      if (rem > 0 || inv.status !== 'PAID') {
        const pendingAmt = rem > 0 ? rem : tot;
        pendingTotal += pendingAmt;

        if (!studentDuesMap.has(uniqueKey)) {
          studentDuesMap.set(uniqueKey, {
            studentId: sInfo.id || sId,
            studentName: sName,
            rollNo: inv.rollNo || sInfo.rollNo || 'STU-1001',
            className: cName,
            sectionName: secName,
            totalFee: 0,
            paid: 0,
            pending: 0,
          });
        }
        const item = studentDuesMap.get(uniqueKey);
        item.totalFee += tot;
        item.paid += paid;
        item.pending += pendingAmt;
      }
    });

    const topPendingStudents = Array.from(studentDuesMap.values()).sort((a, b) => b.pending - a.pending);
    const pendingStudentsCount = topPendingStudents.length;

    let totalExpenses = 0;
    const latestExpenses: any[] = [];
    expenses.forEach((e: any) => {
      const amt = Number(e.amount || 0);
      const eDt = parseDocDate(e.date || e.createdAt);
      totalExpenses += amt;
      latestExpenses.push({
        id: e.id || `EXP-${Math.random().toString(36).substring(2, 7)}`,
        category: e.category || 'General Expense',
        amount: amt,
        date: eDt.toISOString(),
        mode: e.paymentMethod || 'Bank Transfer',
      });
    });

    const expectedTotal = yearRevenue + pendingTotal;
    const collectionRate = expectedTotal > 0 ? Math.round((yearRevenue / expectedTotal) * 100) : 0;
    const pendingPercentage = expectedTotal > 0 ? Math.round((pendingTotal / expectedTotal) * 100) : 0;

    // 1. Monthly Revenue & Expenses (Apr to Mar)
    const monthIndexMap: Record<number, string> = {
      3: 'Apr', 4: 'May', 5: 'Jun', 6: 'Jul', 7: 'Aug', 8: 'Sep', 9: 'Oct', 10: 'Nov', 11: 'Dec', 0: 'Jan', 1: 'Feb', 2: 'Mar'
    };
    const monthlyIncomeMap: Record<string, number> = { Apr: 0, May: 0, Jun: 0, Jul: 0, Aug: 0, Sep: 0, Oct: 0, Nov: 0, Dec: 0, Jan: 0, Feb: 0, Mar: 0 };
    const monthlyExpenseMap: Record<string, number> = { Apr: 0, May: 0, Jun: 0, Jul: 0, Aug: 0, Sep: 0, Oct: 0, Nov: 0, Dec: 0, Jan: 0, Feb: 0, Mar: 0 };

    payments.forEach((p: any) => {
      const dt = parseDocDate(p.paymentDate || p.createdAt);
      const mKey = monthIndexMap[dt.getMonth()];
      if (mKey) {
        const amt = p.amountCents !== undefined ? p.amountCents / 100 : Number(p.amount || 0);
        monthlyIncomeMap[mKey] += amt;
      }
    });

    expenses.forEach((e: any) => {
      const dt = parseDocDate(e.date || e.createdAt);
      const mKey = monthIndexMap[dt.getMonth()];
      if (mKey) {
        monthlyExpenseMap[mKey] += Number(e.amount || 0);
      }
    });

    const incomeVsExpense = Object.keys(monthlyIncomeMap).map(m => ({
      month: m,
      income: monthlyIncomeMap[m],
      expenses: monthlyExpenseMap[m],
    }));

    // 2. Daily Collection Trend (Last 30 Days)
    const dailyCollectionTrend: any[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
      let daySum = 0;
      payments.forEach((p: any) => {
        const pDt = parseDocDate(p.paymentDate || p.createdAt);
        if (pDt.getDate() === d.getDate() && pDt.getMonth() === d.getMonth() && pDt.getFullYear() === d.getFullYear()) {
          daySum += p.amountCents !== undefined ? p.amountCents / 100 : Number(p.amount || 0);
        }
      });
      dailyCollectionTrend.push({ date: dateStr, amount: daySum });
    }

    // 3. Payment Methods Distribution
    const methodTotals: Record<string, number> = {};
    payments.forEach((p: any) => {
      const amt = p.amountCents !== undefined ? p.amountCents / 100 : Number(p.amount || 0);
      const m = p.paymentMethod || 'Online Payment';
      methodTotals[m] = (methodTotals[m] || 0) + amt;
    });
    const grandMethodTotal = Object.values(methodTotals).reduce((a, b) => a + b, 0) || 1;
    const paymentMethodsDistribution = Object.entries(methodTotals).map(([method, amount]) => ({
      method,
      amount,
      percentage: Math.round((amount / grandMethodTotal) * 100),
    }));

    // 4. Expense Category Analysis
    const catTotals: Record<string, number> = {};
    expenses.forEach((e: any) => {
      const amt = Number(e.amount || 0);
      const cat = e.category || 'General Expense';
      catTotals[cat] = (catTotals[cat] || 0) + amt;
    });
    const grandCatTotal = Object.values(catTotals).reduce((a, b) => a + b, 0) || 1;
    const expenseCategoryAnalysis = Object.entries(catTotals).map(([categoryName, amount]) => ({
      categoryName,
      amount,
      percentage: Math.round((amount / grandCatTotal) * 100),
    }));

    // 5. Outstanding Dues by Class (Deduplicated unique pending students per class)
    const classPendingMap: Record<string, { totalPending: number; studentSet: Set<string>; totalBilled: number }> = {};
    topPendingStudents.forEach((std: any) => {
      const cName = std.className || 'Class-1';
      if (!classPendingMap[cName]) {
        classPendingMap[cName] = { totalPending: 0, studentSet: new Set<string>(), totalBilled: 0 };
      }
      classPendingMap[cName].totalPending += std.pending;
      classPendingMap[cName].totalBilled += std.totalFee;
      classPendingMap[cName].studentSet.add(std.studentId);
    });

    const outstandingByClass = Object.entries(classPendingMap).map(([className, val], idx) => ({
      classId: `cls-${idx}`,
      className,
      totalPending: val.totalPending,
      studentCount: val.studentSet.size,
      collectionPercentage: val.totalBilled > 0 ? Math.round(((val.totalBilled - val.totalPending) / val.totalBilled) * 100) : 100,
    }));

    // 6. KPIs
    const totalStudents = pendingStudentsCount || invoices.length || 1;
    const kpis = {
      expenseRatio: yearRevenue > 0 ? Math.round((totalExpenses / yearRevenue) * 100) : 0,
      netMargin: yearRevenue > 0 ? Math.round(((yearRevenue - totalExpenses) / yearRevenue) * 100) : 0,
      avgFeePerStudent: Math.round(yearRevenue / totalStudents),
      outstandingRatio: pendingPercentage,
    };

    // 7. Executive Insights
    const topClass = outstandingByClass.sort((a, b) => b.totalPending - a.totalPending)[0]?.className || 'N/A';
    const topCategory = expenseCategoryAnalysis.sort((a, b) => b.amount - a.amount)[0]?.categoryName || 'N/A';
    const executiveInsights = {
      highestPayingClass: classes[0]?.name || 'Class-1',
      highestPendingDuesClass: topClass,
      topRevenueMonth: now.toLocaleDateString('en-US', { month: 'long' }),
      topBudgetCategory: topCategory,
      avgRevenuePerStudent: Math.round(yearRevenue / totalStudents),
      avgPendingPerStudent: pendingStudentsCount > 0 ? Math.round(pendingTotal / pendingStudentsCount) : 0,
    };

    return {
      academicYears: years.map(y => ({ id: y.id, name: y.name })),
      classes: classes.map(c => ({ id: c.id, name: c.name })),
      sections: sections.map(s => ({ id: s.id, name: s.name })),
      summary: {
        revenue: {
          prevMonth: prevMonthRevenue,
          prevMonthInvoicesCount: prevMonthInvoicesCount,
          currentMonth: currentMonthRevenue,
          currentMonthInvoicesCount: currentMonthInvoicesCount,
          academicYear: yearRevenue,
        },
        pending: {
          total: pendingTotal,
          studentsCount: pendingStudentsCount,
        },
        profit: {
          collectionRate,
          pendingPercentage,
          netProfit: yearRevenue - totalExpenses,
          profitMargin: yearRevenue > 0 ? Math.round(((yearRevenue - totalExpenses) / yearRevenue) * 100) : 0,
        },
        cashFlow: {
          openingBalance: 0,
          totalIncome: yearRevenue,
          totalExpenses,
          closingBalance: yearRevenue - totalExpenses,
          expectedIncome: expectedTotal,
          expectedExpenses: totalExpenses,
          netPeriodCashFlow: yearRevenue - totalExpenses,
        },
      },
      charts: {
        incomeVsExpense,
        dailyCollectionTrend,
        paymentMethodsDistribution,
        expenseCategoryAnalysis,
        outstandingByClass,
      },
      kpis,
      insights: {
        executive: executiveInsights,
        topPendingStudents: topPendingStudents.slice(0, 10),
      },
      activities: {
        latestPayments: latestPayments.slice(0, 10),
        latestExpenses: latestExpenses.slice(0, 10),
      },
      notifications: [
        { message: `${pendingStudentsCount} accounts have outstanding fee payments overdue.`, type: 'WARNING' },
        { message: 'Monthly staff payroll recorded in Financial Ledger.', type: 'INFO' }
      ],
    };
  }
}
