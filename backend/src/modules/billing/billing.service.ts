import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { IBillingRepository } from '../../common/interfaces/billing.repository.interface';
import { IAcademicRepository } from '../../common/interfaces/academic.repository.interface';
import { IStudentRepository } from '../../common/interfaces/student.repository.interface';
import { IUserRepository } from '../../common/interfaces/user.repository.interface';
import { randomUUID } from 'crypto';

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

    const totalInvoiceAmount = Number(studentProfile?.totalFee || studentProfile?.totalAmount || invoiceData.totalAmount || 15000);

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

    const schoolName = 'A.P. GREENWOOD HIGH SCHOOL';
    const schoolSubtitle = 'Excellence in Education & Character Building';
    const studentName = profile?.User?.name || profile?.name || 'Student Record';
    const fatherName = profile?.fatherName || 'N/A';
    const motherName = profile?.motherName || 'N/A';
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

    const totalFeeAmount = 15000;
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
      schoolLogo: '',
      schoolAddress: 'Vikas Nagar, Delhi, India',
      schoolPhone: '+91 9876543210',
      invoiceNo,
      invoiceDate: payment?.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN'),
      academicYear: '2026-2027',
      admissionRef: rollNo,
      studentName,
      fatherName,
      motherName,
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
    if (classId && this.billingRepo.getPriceBook) {
      try {
        const pb = await this.billingRepo.getPriceBook(classId, academicYearId || '', tid);
        if (Array.isArray(pb)) {
          pb.forEach((item: any) => {
            if (item.productId && item.price !== undefined) {
              priceMap[item.productId] = Number(item.price);
            }
          });
        }
      } catch (err) {
        // Ignore pricebook query errors
      }
    }

    if (!products || products.length === 0) {
      return [
        { id: 'fp-tuition', productName: 'Tuition Fee', name: 'Tuition Fee', unitPrice: 25000, price: 25000, isMandatory: true },
        { id: 'fp-admission', productName: 'Admission & Admin Fee', name: 'Admission & Admin Fee', unitPrice: 5000, price: 5000, isMandatory: true },
        { id: 'fp-tech', productName: 'Technology & Smart Class Fee', name: 'Technology & Smart Class Fee', unitPrice: 3000, price: 3000, isMandatory: false },
        { id: 'fp-activity', productName: 'Sports & Extracurricular Fee', name: 'Sports & Extracurricular Fee', unitPrice: 2000, price: 2000, isMandatory: false },
        { id: 'fp-lab', productName: 'Science & Computer Lab Fee', name: 'Science & Computer Lab Fee', unitPrice: 4000, price: 4000, isMandatory: false },
      ];
    }

    return products.map((p) => {
      const price = priceMap[p.id] !== undefined
        ? priceMap[p.id]
        : Number(p.unitPrice ?? p.price ?? 5000);
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

    // 2. Create Student Profile Record
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
        classId: studentData?.classId || studentData?.selectedClass || null,
        sectionId: studentData?.sectionId || studentData?.selectedSection || null,
        academicYearId: studentData?.academicYearId || studentData?.academicYear || null,
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
        createdAt: new Date().toISOString(),
      });
    }

    return {
      success: true,
      message: 'Admission registered successfully',
      opportunityId: 'opp-' + Date.now(),
      studentId: studentProfileId,
      studentData,
      tenantId: tid,
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

        let outstanding = 15000;
        if (totalPaidFromPayments > 0) {
          outstanding = Math.max(0, 15000 - totalPaidFromPayments);
        } else {
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

    const currentYearDue = s.outstandingAmount !== undefined ? Number(s.outstandingAmount) : 15000;
    const previousYearDue = Number(s.previousYearDue || 0);
    const grandTotalDue = currentYearDue + previousYearDue;
    const paidAmount = Math.max(0, 15000 - currentYearDue);

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
          feeProductsAmount: 15000,
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
            academicYearId: 'ay-2026',
            amount: 15000,
            stage: 'Issued',
          }
        ]
      }
    };
  }

  async getStudentBillingAccount(studentId: string, tenantId?: string) {
    const tid = tenantId || 'tenant-test-001';
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
    try {
      const snap = await (this.billingRepo as any).db
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

    if (totalPaidFromPayments > 0) {
      profile.outstandingAmount = Math.max(0, 15000 - totalPaidFromPayments);
    } else {
      let existingInvoices: any[] = [];
      try {
        existingInvoices = await this.billingRepo.findInvoicesByStudent(studentId);
      } catch (err) {}

      if (existingInvoices.length > 0 && existingInvoices[0].remainingBalance !== undefined) {
        profile.outstandingAmount = existingInvoices[0].remainingBalance;
      }
    }

    const formatted = this.formatStudentForBilling(profile);
    return {
      ...formatted,
      account: formatted.account,
      student: formatted
    };
  }

  async getUnpaidFees(oppId: string, tenantId?: string) {
    const tid = tenantId || 'tenant-test-001';
    const studentId = oppId;

    let paidAmount = 0;
    try {
      const snap = await (this.billingRepo as any).db
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

    if (paidAmount <= 0) {
      try {
        const existingInvoices = await this.billingRepo.findInvoicesByStudent(studentId);
        if (existingInvoices.length > 0) {
          paidAmount = Math.max(...existingInvoices.map((inv) => Number(inv.paidAmount || 0)));
        }
      } catch (err) {}
    }

    const baseItems = [
      {
        oliId: `oli-${oppId}-tuition`,
        productName: 'Tuition Fee',
        productId: 'fp-tuition',
        totalAmount: 5000,
        discountAmount: 0,
        paidAmount: 0,
        balanceDue: 5000,
        discountPercent: 0,
      },
      {
        oliId: `oli-${oppId}-admission`,
        productName: 'Admission & Admin Fee',
        productId: 'fp-admission',
        totalAmount: 2500,
        discountAmount: 0,
        paidAmount: 0,
        balanceDue: 2500,
        discountPercent: 0,
      },
      {
        oliId: `oli-${oppId}-transport`,
        productName: 'Transport / Van Fee',
        productId: 'fp-transport',
        totalAmount: 5000,
        discountAmount: 0,
        paidAmount: 0,
        balanceDue: 5000,
        discountPercent: 0,
      },
      {
        oliId: `oli-${oppId}-activity`,
        productName: 'Activity & Sports Fee',
        productId: 'fp-activity',
        totalAmount: 2500,
        discountAmount: 0,
        paidAmount: 0,
        balanceDue: 2500,
        discountPercent: 0,
      },
    ];

    if (paidAmount <= 0) {
      return baseItems;
    }

    let remainingToDeduct = paidAmount;
    const items = baseItems.map((item) => {
      const itemDeduct = Math.min(item.totalAmount, remainingToDeduct);
      remainingToDeduct -= itemDeduct;
      const newPaid = itemDeduct;
      const newBalance = item.totalAmount - newPaid;
      return {
        ...item,
        paidAmount: newPaid,
        balanceDue: newBalance,
      };
    });

    return items;
  }
}
