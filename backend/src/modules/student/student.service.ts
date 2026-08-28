import { Injectable, Inject } from '@nestjs/common';
import { IStudentRepository } from '../../common/interfaces/student.repository.interface';
import { randomUUID } from 'crypto';

@Injectable()
export class StudentService {
  constructor(@Inject('IStudentRepository') private readonly studentRepo: IStudentRepository) {}

  async findAll(tenantId: string, page = 1, limit = 100, filters?: any) {
    if (!tenantId) throw new Error('tenantId is required');
    const res = await this.studentRepo.findStudentsByTenant(tenantId, page, limit, filters);
    const items = res?.items || [];
    const total = res?.total !== undefined ? res.total : items.length;
    return {
      data: items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / (limit || 100))),
    };
  }

  async findOne(id: string, tenantId?: string, academicYearId?: string) {
    const profile = await this.studentRepo.findProfileById(id);
    if (!profile) return null;

    const tid = tenantId || profile.tenantId || '';
    if (!tid) return null;
    const db = (this.studentRepo as any).db;

    let invoices: any[] = [];
    let examMarks: any[] = [];
    let configuredExams: string[] = [];
    let feeItems: any[] = [];

    let totalFees = Number(profile.totalFees || profile.totalFeeAmount || profile.allocatedAmount || 15000);
    let paidAmount = profile.totalPaidAmount !== undefined ? Number(profile.totalPaidAmount) : Number(profile.paidAmount || 0);
    let discountAmount = Number(profile.discountAmount || profile.discountGiven || 0);
    let balanceDue = profile.outstandingAmount !== undefined ? Number(profile.outstandingAmount) : (profile.totalPendingBalance !== undefined ? Number(profile.totalPendingBalance) : (profile.balanceDue !== undefined ? Number(profile.balanceDue) : Math.max(0, totalFees - discountAmount - paidAmount)));

    if (db) {
      try {
        // 1. Fetch Invoices
        let invSnap = await db.collection('tenants').doc(tid).collection('invoices')
          .where('studentId', '==', id)
          .get()
          .catch(() => null);

        if (!invSnap || invSnap.empty) {
          invSnap = await db.collectionGroup('invoices')
            .where('studentId', '==', id)
            .get()
            .catch(() => null);
        }

        if (invSnap && !invSnap.empty) {
          invoices = invSnap.docs.map((doc: any) => {
            const data = doc.data();
            const invTotal = Number(data.totalAmount || data.amount || 0);
            const invPaid = Number(data.paidAmount || 0);
            const invRem = Number(data.remainingBalance !== undefined ? data.remainingBalance : (invTotal - invPaid));
            const statusStr = String(data.status || '').toUpperCase();
            const isPaid = statusStr === 'PAID' || invRem <= 0;
            return {
              id: doc.id,
              date: data.invoiceDate || data.createdAt || new Date().toISOString(),
              invoiceDate: data.invoiceDate || data.createdAt || new Date().toISOString(),
              number: data.invoiceNumber || data.number || `INV-${doc.id.substring(0, 8).toUpperCase()}`,
              mode: data.paymentMethod || data.mode || 'CASH',
              paymentMethod: data.paymentMethod || data.mode || 'CASH',
              amount: invTotal,
              totalAmount: invTotal,
              paidAmount: invPaid,
              remainingBalance: Math.max(0, invRem),
              status: isPaid ? 'PAID' : (invPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID'),
              items: data.items || data.invoiceItems || [{ name: 'Tuition & Session Fees', amount: invTotal }]
            };
          });

          // Recalculate paidAmount and balanceDue if invoices exist
          const invPaidSum = invoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
          if (invPaidSum > 0) {
            paidAmount = invPaidSum;
            balanceDue = Math.max(0, totalFees - discountAmount - paidAmount);
          }
        }

        // 2. Fetch Student Fee Items (allocated fee breakdown for selected student)
        if (profile.feeItems && Array.isArray(profile.feeItems) && profile.feeItems.length > 0) {
          feeItems = profile.feeItems.map((item: any) => ({
            oliId: item.id || item.oliId || 'item-1',
            productName: item.name || item.productName || 'Academic Fee',
            price: Number(item.price || item.totalAmount || totalFees),
            grossTotal: Number(item.grossTotal || item.totalAmount || totalFees),
            discountPercent: Number(item.discountPercent || 0),
            discountAmount: Number(item.discountAmount || 0),
            netTotal: Number(item.netTotal || item.amount || totalFees),
            paidAmount: Number(item.paidAmount || 0),
            balanceDue: Number(item.balanceDue || 0)
          }));
        } else {
          feeItems = [
            {
              oliId: 'item-1',
              productName: 'Academic Fee',
              price: totalFees,
              grossTotal: totalFees,
              discountPercent: 0,
              discountAmount: discountAmount,
              netTotal: Math.max(0, totalFees - discountAmount),
              paidAmount,
              balanceDue
            }
          ];
        }

        // 3. Fetch Exam Marks for selected student
        let marksSnap = await db.collection('tenants').doc(tid).collection('examMarks')
          .where('studentId', '==', id)
          .get()
          .catch(() => null);

        if (!marksSnap || marksSnap.empty) {
          marksSnap = await db.collectionGroup('examMarks')
            .where('studentId', '==', id)
            .get()
            .catch(() => null);
        }

        if (marksSnap && !marksSnap.empty) {
          examMarks = marksSnap.docs.map((d: any) => {
            const m = d.data();
            const exType = m.examName || m.examType || m.exam?.name || m.exam?.type || 'Unit Test';
            const subName = m.subjectName || m.subject?.name || 'Subject';
            return {
              id: d.id,
              score: Number(m.marksObtained !== undefined ? m.marksObtained : (m.score || 0)),
              marksObtained: Number(m.marksObtained !== undefined ? m.marksObtained : (m.score || 0)),
              maxMarks: Number(m.maxMarks || 100),
              exam: {
                id: m.examId || exType,
                name: exType,
                type: exType
              },
              subject: {
                id: m.subjectId || subName,
                name: subName
              }
            };
          });
        }

        // 4. Fetch Configured Exam Types from school configuration + saved marks
        let etSnap = await db.collection('tenants').doc(tid).collection('examTypes').get().catch(() => null);
        const configuredSet = new Set<string>();

        if (etSnap && !etSnap.empty) {
          etSnap.docs.forEach((d: any) => {
            const n = d.data()?.name;
            if (n) configuredSet.add(n);
          });
        }

        if (configuredSet.size === 0) {
          let exSnap = await db.collection('tenants').doc(tid).collection('exams').get().catch(() => null);
          if (exSnap && !exSnap.empty) {
            exSnap.docs.forEach((d: any) => {
              const t = d.data()?.type || d.data()?.examType || d.data()?.name;
              if (t) configuredSet.add(t);
            });
          }
        }

        // Also add any exam names present in the student's marks
        examMarks.forEach(m => {
          if (m.exam?.name) configuredSet.add(m.exam.name);
        });

        configuredExams = Array.from(configuredSet);
      } catch (err) {
        console.error('Failed to resolve student detail relationships:', err);
      }
    }

    // 5. Calculate Progress Card Percentage from actual completed exam marks
    let progressPercentage: number | null = null;
    if (examMarks.length > 0) {
      const totalScore = examMarks.reduce((sum, m) => sum + Number(m.marksObtained || m.score || 0), 0);
      const totalMax = examMarks.reduce((sum, m) => sum + Number(m.maxMarks || 100), 0);
      if (totalMax > 0) {
        progressPercentage = Math.round((totalScore / totalMax) * 100);
      }
    }

    return {
      ...profile,
      paidAmount,
      balanceDue,
      totalFees,
      invoices,
      feeItems,
      feeSummary: {
        currentYear: {
          feeProductsAmount: totalFees,
          paidAmount: paidAmount,
          pendingAmount: balanceDue,
          discountAmount: discountAmount
        },
        previousYears: profile.previousYearsDues || []
      },
      examMarks,
      configuredExams: configuredExams.length > 0 ? configuredExams : ['Unit Test', 'Mid Term', 'Final Exam'],
      progressPercentage,
    };
  }

  async create(data: any, tenantId: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const id = data.id || randomUUID();
    return this.studentRepo.createProfile({
      ...data,
      id,
      tenantId,
      createdAt: new Date().toISOString(),
    });
  }

  async update(id: string, data: any, tenantId: string) {
    return this.studentRepo.updateProfile(id, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  }

  async delete(id: string, tenantId: string) {
    if (this.studentRepo.deleteProfile) {
      return this.studentRepo.deleteProfile(id);
    }
    return { success: true, id };
  }

  async importStudentsBulk(studentsData: any[], tenantId: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const tid = tenantId;
    let importedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < studentsData.length; i++) {
      const row = studentsData[i];
      try {
        const studentName = (row.name || row.studentName || row.fullName || `${row.firstName || ''} ${row.lastName || ''}`).trim() || `Student ${i + 1}`;
        const phone = (row.phone || row.mobileNumber || row.contact || '').replace(/\D/g, '');
        const email = (row.email || `student_${Date.now()}_${i}@school.com`).trim();
        const rollNo = (row.rollNo || row.rollNumber || `STU-${1000 + i}`).trim();
        const fatherName = (row.fatherName || row.parentName || '').trim();
        const motherName = (row.motherName || '').trim();

        const userId = randomUUID();
        const studentId = randomUUID();

        await this.studentRepo.createProfile({
          id: studentId,
          userId,
          tenantId: tid,
          rollNo,
          fatherName,
          motherName,
          user: {
            id: userId,
            name: studentName,
            email,
            phone,
            role: 'STUDENT',
            tenantId: tid,
            isActive: true,
          },
          classSection: {
            class: { name: row.className || row.class || 'Class 1' },
            section: { name: row.sectionName || row.section || 'A' }
          },
          createdAt: new Date().toISOString(),
        });

        importedCount++;
      } catch (err: any) {
        errors.push(`Row ${i + 1}: ${err.message || 'Import failed'}`);
      }
    }

    return {
      success: true,
      importedCount,
      totalRecords: studentsData.length,
      errors,
    };
  }

  async getPromotionCandidates(tenantId: string, sourceYearId?: string, className?: string, sectionName?: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const res = await this.studentRepo.findStudentsByTenant(tenantId, 1, 1000, {
      className: className !== 'ALL' ? className : undefined,
      sectionName: sectionName || undefined,
    });
    const items = res?.items || [];
    return items.map((s: any) => {
      const clsName = s.classSection?.class?.name || s.className || s.class || 'Class-1';
      const secName = s.classSection?.section?.name || s.sectionName || s.section || 'Section A';
      const name = s.user?.name || s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Student';
      return {
        id: s.id,
        name,
        rollNo: s.rollNo || s.rollNumber || 'STU-001',
        class: clsName,
        section: secName,
        academicYearId: s.academicYearId || sourceYearId || '',
        pendingFees: s.balanceDue || 0,
        isEligible: true,
        guardianName: s.fatherName || s.motherName || 'Parent',
        phone: s.user?.phone || s.phone || '',
      };
    });
  }

  private async resolveAcademicYearDoc(tid: string, yearInput?: string): Promise<{ id: string; name: string }> {
    if (!yearInput) return { id: 'ay-2027-2028', name: '2027-2028' };
    const db = (this.studentRepo as any).db;
    if (!db) return { id: yearInput, name: yearInput };

    try {
      const aySnap = await db.collection('tenants').doc(tid).collection('academicYears').get().catch(() => null);
      if (aySnap && !aySnap.empty) {
        for (const doc of aySnap.docs) {
          const d = doc.data();
          if (
            doc.id === yearInput ||
            d.id === yearInput ||
            d.name === yearInput ||
            d.code === yearInput ||
            (d.name && yearInput.includes(d.name)) ||
            (d.id && yearInput.includes(d.id))
          ) {
            return { id: doc.id, name: d.name || d.code || yearInput };
          }
        }
      }
    } catch (e) {}

    return { id: yearInput, name: yearInput };
  }

  private async resolveClassDoc(tid: string, classInput?: string): Promise<{ id: string; name: string }> {
    if (!classInput || classInput === 'ALL') return { id: 'Class-2', name: 'Class-2' };
    const db = (this.studentRepo as any).db;
    if (!db) return { id: classInput, name: classInput };

    try {
      const clsSnap = await db.collection('tenants').doc(tid).collection('classes').get().catch(() => null);
      if (clsSnap && !clsSnap.empty) {
        for (const doc of clsSnap.docs) {
          const d = doc.data();
          if (
            doc.id === classInput ||
            d.id === classInput ||
            d.name?.toLowerCase() === classInput.toLowerCase()
          ) {
            return { id: doc.id, name: d.name || classInput };
          }
        }
      }
    } catch (e) {}

    return { id: classInput, name: classInput };
  }

  private async resolveDestinationPriceBook(tid: string, classId: string, academicYearId: string): Promise<{ configured: boolean; totalAmount: number; items: any[] }> {
    const db = (this.studentRepo as any).db;
    if (!db) return { configured: true, totalAmount: 0, items: [] };

    let totalAmount = 0;
    const items: any[] = [];
    let configured = false;

    try {
      // Query tenants/{tid}/priceBooks
      const pbSnap = await db.collection('tenants').doc(tid).collection('priceBooks')
        .where('academicYearId', '==', academicYearId)
        .where('classId', '==', classId)
        .get().catch(() => null);

      if (pbSnap && !pbSnap.empty) {
        configured = true;
        pbSnap.docs.forEach((doc: any) => {
          const data = doc.data();
          if (data.price !== undefined && data.selected !== false) {
            const price = Number(data.price || 0);
            totalAmount += price;
            items.push({
              productId: data.productId || doc.id,
              name: data.name || data.productName || 'Fee Product',
              price,
              unitPrice: price,
            });
          }
        });
      } else {
        // Fallback check root pricebooks or pricebooks subcollection
        const rootSnap = await db.collection('tenants').doc(tid).collection('pricebooks')
          .where('classId', '==', classId)
          .get().catch(() => null);
        if (rootSnap && !rootSnap.empty) {
          configured = true;
          rootSnap.docs.forEach((doc: any) => {
            const data = doc.data();
            if (data.price !== undefined && data.selected !== false) {
              const price = Number(data.price || 0);
              totalAmount += price;
              items.push({
                productId: data.productId || doc.id,
                name: data.name || data.productName || 'Fee Product',
                price,
                unitPrice: price,
              });
            }
          });
        }
      }
    } catch (e) {}

    return { configured, totalAmount, items };
  }

  private async calculatePreviousYearOutstanding(student: any, sid: string, tid: string, sourceYearId?: string): Promise<number> {
    const db = (this.studentRepo as any).db;
    let invoiceUnpaidTotal = 0;
    let invoicePaidTotal = 0;

    if (db) {
      try {
        const invSnap = await db.collection('tenants').doc(tid).collection('invoices').where('studentId', '==', sid).get().catch(() => null);
        if (invSnap && !invSnap.empty) {
          invSnap.docs.forEach((doc: any) => {
            const d = doc.data();
            const isRelevantYear = !sourceYearId || d.academicYearId === sourceYearId || d.sourceYearId === sourceYearId || !d.academicYearId;
            if (isRelevantYear) {
              const paid = Number(d.paidAmount || 0);
              const bal = Number(d.remainingBalance ?? d.balanceDue ?? ((d.totalAmount || 0) - paid));
              invoicePaidTotal += paid;
              if (d.status !== 'PAID' && bal > 0) {
                invoiceUnpaidTotal += bal;
              }
            }
          });
        }
      } catch (e) {}
    }

    if (invoiceUnpaidTotal > 0) return invoiceUnpaidTotal;
    const profileDue = Math.max(0, Number(student?.previousYearOutstanding ?? student?.balanceDue ?? student?.totalPendingBalance ?? 0));
    if (profileDue > 0) return profileDue;
    return 0;
  }

  async validatePromotions(
    tenantId: string,
    studentIds: string[],
    sourceYearId?: string,
    targetYearId?: string,
    targetClassName?: string,
    targetSectionName?: string,
  ) {
    if (!tenantId || tenantId === 'undefined' || tenantId === 'null') throw new Error('tenantId is required');
    const tid = tenantId;

    // 1. Resolve Target Academic Year & Class
    const targetYearDoc = await this.resolveAcademicYearDoc(tid, targetYearId);
    const targetClassDoc = await this.resolveClassDoc(tid, targetClassName);

    // 2. Resolve Next Year Price Book for Target Year & Class
    const priceBookInfo = await this.resolveDestinationPriceBook(tid, targetClassDoc.id, targetYearDoc.id);

    // 3. Price Book Validation Check (Requirement #9)
    if (!priceBookInfo.configured) {
      const errorMsg = `Price Book is not configured for ${targetClassDoc.name} for Academic Year ${targetYearDoc.name}. Please configure the Price Book before promoting this student.`;
      return {
        priceBookConfigured: false,
        error: errorMsg,
        message: errorMsg,
        totalSelected: studentIds.length,
        validCount: 0,
        warningCount: 0,
        studentsWithNoDue: 0,
        studentsWithPendingDue: 0,
        totalOutstandingDue: 0,
        dueList: [],
        warnings: [],
      };
    }

    let totalSelected = studentIds.length;
    let studentsWithNoDue = 0;
    let studentsWithPendingDue = 0;
    let totalOutstandingDue = 0;
    let totalPreviousYearDue = 0;
    let totalNextYearFee = 0;
    const dueList: any[] = [];

    const nextYearFee = priceBookInfo.totalAmount;

    for (const sid of studentIds) {
      let student: any = null;
      try {
        student = await this.studentRepo.findProfileById(sid);
      } catch (e) {}

      const studentName = student?.name || student?.fullName || (student?.firstName ? `${student.firstName} ${student.lastName || ''}`.trim() : 'Student');
      const sourceClsName = student?.className || student?.classSection?.class?.name || 'Class-1';
      const sourceSecName = student?.sectionName || student?.classSection?.section?.name || 'Section A';
      const rollNo = student?.rollNo || student?.admissionNo || '—';

      const previousYearDue = await this.calculatePreviousYearOutstanding(student, sid, tid, sourceYearId);
      const pendingDue = previousYearDue + nextYearFee;

      totalPreviousYearDue += previousYearDue;
      totalNextYearFee += nextYearFee;
      totalOutstandingDue += pendingDue;

      if (pendingDue > 0) {
        studentsWithPendingDue++;
      } else {
        studentsWithNoDue++;
      }

      dueList.push({
        studentId: sid,
        name: studentName,
        rollNo,
        class: sourceClsName,
        section: sourceSecName,
        sourceClass: sourceClsName,
        sourceSection: sourceSecName,
        sourceYear: sourceYearId || student?.academicYearId || '2026-2027',
        targetClass: targetClassDoc.name,
        targetSection: targetSectionName || sourceSecName,
        targetYear: targetYearDoc.name,
        previousYearDue,
        nextYearFee,
        pendingDue,
      });
    }

    return {
      priceBookConfigured: true,
      nextYearPriceBookTotal: nextYearFee,
      targetClassName: targetClassDoc.name,
      targetYearName: targetYearDoc.name,
      totalSelected,
      studentsWithNoDue,
      studentsWithPendingDue,
      totalOutstandingDue,
      totalPreviousYearDue,
      totalNextYearFee,
      totalOutstandingBalance: totalOutstandingDue,
      validCount: studentsWithNoDue,
      warningCount: studentsWithPendingDue,
      warnings: dueList,
      dueList,
    };
  }

  async executePromotions(
    tenantId: string,
    studentIds: string[],
    sourceYearId?: string,
    targetYearId?: string,
    targetClassName?: string,
    targetSectionName?: string,
  ) {
    if (!tenantId || tenantId === 'undefined' || tenantId === 'null') throw new Error('tenantId is required');
    const tid = tenantId;
    const db = (this.studentRepo as any).db;

    // 1. Resolve Target Academic Year & Class
    const targetYearDoc = await this.resolveAcademicYearDoc(tid, targetYearId);
    const targetClassDoc = await this.resolveClassDoc(tid, targetClassName);

    // 2. Resolve Price Book for Destination Year & Class
    const priceBookInfo = await this.resolveDestinationPriceBook(tid, targetClassDoc.id, targetYearDoc.id);

    if (!priceBookInfo.configured) {
      throw new Error(`Price Book is not configured for ${targetClassDoc.name} for Academic Year ${targetYearDoc.name}. Please configure the Price Book before promoting this student.`);
    }

    let promotedCount = 0;
    let totalCarriedForwardAmount = 0;
    let studentsWithCarriedForwardDues = 0;
    const studentOutstandingBalances: any[] = [];
    const errors: string[] = [];

    const CLASS_ORDER = [
      'Nursery', 'LKG', 'UKG',
      'Class-1', 'Class-2', 'Class-3', 'Class-4', 'Class-5', 'Class-6', 'Class-7', 'Class-8', 'Class-9', 'Class-10',
      'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'
    ];

    const getNextCls = (curr: string): string => {
      if (!curr) return 'Class-2';
      const idx = CLASS_ORDER.findIndex(c => c.toLowerCase() === curr.toLowerCase());
      if (idx >= 0 && idx < CLASS_ORDER.length - 1) return CLASS_ORDER[idx + 1];
      return curr;
    };

    for (let idx = 0; idx < studentIds.length; idx++) {
      const sid = studentIds[idx];
      try {
        const student = await this.studentRepo.findProfileById(sid);
        if (student) {
          const studentName = student.name || student.fullName || (student.firstName ? `${student.firstName} ${student.lastName || ''}`.trim() : 'Student');
          const currentCls = student.classSection?.class?.name || student.className || student.class || 'Class-1';
          const currentSec = student.classSection?.section?.name || student.sectionName || student.section || 'Section A';
          const nextCls = targetClassDoc.name || ((!targetClassName || targetClassName === 'ALL') ? getNextCls(currentCls) : targetClassName);
          const nextSec = targetSectionName || currentSec;

          // 1. Calculate previous year outstanding balance & next year fee
          const previousYearDue = await this.calculatePreviousYearOutstanding(student, sid, tid, sourceYearId);
          const nextYearFee = priceBookInfo.totalAmount;
          const totalPayable = previousYearDue + nextYearFee;

          if (previousYearDue > 0) {
            studentsWithCarriedForwardDues++;
            totalCarriedForwardAmount += previousYearDue;
          }

          studentOutstandingBalances.push({
            studentId: sid,
            name: studentName,
            rollNo: student.rollNo || student.admissionNo || '—',
            carriedForwardAmount: previousYearDue,
            nextYearFee,
            totalOutstanding: totalPayable,
          });

          // 2. Update Student Profile with Target Academic Year, Target Class, and Total Fee Balances
          await this.studentRepo.updateProfile(sid, {
            academicYearId: targetYearDoc.id,
            classSection: {
              class: { name: nextCls },
              section: { name: nextSec },
            },
            className: nextCls,
            sectionName: nextSec,
            previousYearOutstanding: previousYearDue,
            nextYearClassFee: nextYearFee,
            balanceDue: totalPayable,
            totalPendingBalance: totalPayable,
            financialStatus: totalPayable > 0 ? 'PARTIALLY_PAID' : 'PAID',
            updatedAt: new Date().toISOString(),
          });

          if (db) {
            const timestamp = Date.now();

            // 3. Create Traceable Carried Forward Previous Year Balance Invoice (if previousYearDue > 0)
            if (previousYearDue > 0) {
              const carryInvId = `inv-carry-${sid}-${timestamp}`;
              const carryInvoice = {
                id: carryInvId,
                invoiceNumber: `INV-CARRY-${timestamp.toString().slice(-6)}-${idx}`,
                studentId: sid,
                studentName,
                academicYearId: targetYearDoc.id,
                sourceYearId: sourceYearId || student.academicYearId || 'ay-2026',
                className: nextCls,
                sectionName: nextSec,
                type: 'PREVIOUS_YEAR_DUE',
                description: `Previous Year Balance Brought Forward from Academic Year ${sourceYearId || '2026-2027'}`,
                totalAmount: previousYearDue,
                paidAmount: 0,
                balanceDue: previousYearDue,
                remainingBalance: previousYearDue,
                status: 'UNPAID',
                invoiceDate: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                tenantId: tid,
              };
              await db.collection('tenants').doc(tid).collection('invoices').doc(carryInvId).set(carryInvoice, { merge: true }).catch(() => null);
              await db.collection('invoices').doc(carryInvId).set(carryInvoice, { merge: true }).catch(() => null);
            }

            // 4. Create Next Academic Year Fees Invoice for Target Class Price Book (if nextYearFee > 0)
            if (nextYearFee > 0) {
              const nyfInvId = `inv-nyf-${sid}-${timestamp}`;
              const nyfInvoice = {
                id: nyfInvId,
                invoiceNumber: `INV-NYF-${timestamp.toString().slice(-6)}-${idx}`,
                studentId: sid,
                studentName,
                academicYearId: targetYearDoc.id,
                className: nextCls,
                sectionName: nextSec,
                type: 'ACADEMIC_YEAR_FEE',
                description: `${targetYearDoc.name} ${nextCls} Fees`,
                totalAmount: nextYearFee,
                paidAmount: 0,
                balanceDue: nextYearFee,
                remainingBalance: nextYearFee,
                status: 'UNPAID',
                items: priceBookInfo.items,
                invoiceDate: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                tenantId: tid,
              };
              await db.collection('tenants').doc(tid).collection('invoices').doc(nyfInvId).set(nyfInvoice, { merge: true }).catch(() => null);
              await db.collection('invoices').doc(nyfInvId).set(nyfInvoice, { merge: true }).catch(() => null);
            }
          }

          promotedCount++;
        }
      } catch (err: any) {
        errors.push(`Student ${sid}: ${err.message || 'Promotion failed'}`);
      }
    }

    return {
      success: true,
      promotedCount,
      studentsWithCarriedForwardDues,
      totalCarriedForwardAmount,
      studentOutstandingBalances,
      errors,
      targetYearId: targetYearDoc.id,
      targetYearName: targetYearDoc.name,
    };
  }
}
