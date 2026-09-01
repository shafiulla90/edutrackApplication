import { Injectable, Inject, Optional } from '@nestjs/common';
import { FirebaseService } from '../../database/firebase.service';
import { IStudentRepository } from '../../common/interfaces/student.repository.interface';
import { ITeacherRepository } from '../../common/interfaces/teacher.repository.interface';
import { IAcademicRepository } from '../../common/interfaces/academic.repository.interface';
import { DashboardStatsService } from './dashboard-stats.service';

@Injectable()
export class DashboardService {
  constructor(
    @Inject('IStudentRepository') private readonly studentRepo: IStudentRepository,
    @Inject('ITeacherRepository') private readonly teacherRepo: ITeacherRepository,
    @Inject('IAcademicRepository') private readonly academicRepo: IAcademicRepository,
    private readonly dashboardStatsService: DashboardStatsService,
    @Optional() private readonly firebase?: FirebaseService,
  ) {}

  async getDashboardSummary(tenantId?: string) {
    const tid = tenantId && tenantId !== 'undefined' && tenantId !== 'null' ? tenantId : 'tenant-test-001';

    // Parallelize count calculations, recent student fetch, and invoice calculation
    const [statsResult, studentRes, invoiceRes] = await Promise.all([
      // 1. Centralized stats service (same source of truth as /tenant/setup-status)
      this.dashboardStatsService.getTenantStats(tid),

      // 2. Fetch Recent Students (limit 10 for admissions list instead of 1000)
      this.studentRepo.findStudentsByTenant(tid, 1, 10),

      // 3. Fetch Invoices / Revenue & Recent Payments
      this.fetchInvoicesAndPayments(tid),
    ]);

    const { studentsCount, teachersCount, classesCount } = statsResult;
    const students = studentRes?.items || [];
    const { totalRevenue, recentPayments } = invoiceRes;

    // Format recent admissions
    const recentAdmissions = students.slice(0, 10).map((s: any) => ({
      id: s.id,
      name: s.name || s.user?.name || 'Student',
      rollNo: s.rollNo || 'N/A',
      className: s.className || s.classSection?.class?.name || 'Grade 1',
      sectionName: s.sectionName || s.classSection?.section?.name || 'Section A',
      joiningDate: s.createdAt || new Date().toISOString().split('T')[0],
      phone: s.user?.phone || s.phone || s.parentPhone || 'N/A',
      status: s.status || 'Active',
    }));

    return {
      success: true,
      stats: {
        studentsCount,
        teachersCount,
        classesCount,
        totalRevenue,
        totalExpenses: 0,
        netIncome: totalRevenue,
        attendanceRate: 94.2,
        academicAverage: 85.6,
        pendingLeaveRequests: 0,
        approvedToday: 0,
        rejectedToday: 0,
        trends: {
          students: { value: '+5%', isUp: true },
          revenue: { value: '+12%', isUp: true },
          attendance: { value: '1.5%', isUp: true },
          academic: { value: '0.8%', isUp: true },
        },
      },
      recentAdmissions,
      recentPayments,
      chartData: [
        { month: 'Jan', feeCollection: totalRevenue * 0.15, salaryExpense: 0, netRevenue: totalRevenue * 0.15 },
        { month: 'Feb', feeCollection: totalRevenue * 0.20, salaryExpense: 0, netRevenue: totalRevenue * 0.20 },
        { month: 'Mar', feeCollection: totalRevenue * 0.25, salaryExpense: 0, netRevenue: totalRevenue * 0.25 },
        { month: 'Apr', feeCollection: totalRevenue * 0.40, salaryExpense: 0, netRevenue: totalRevenue * 0.40 },
      ],
    };
  }

  private async fetchInvoicesAndPayments(tid: string): Promise<{ totalRevenue: number; recentPayments: any[] }> {
    let totalRevenue = 0;
    let recentPayments: any[] = [];

    if (this.firebase) {
      const db = this.firebase.getFirestore();
      try {
        const invSnap = await db.collection('tenants').doc(tid).collection('invoices').get();
        invSnap.docs.forEach((doc) => {
          const d = doc.data();
          const paid = Number(d.paidAmount || d.amountPaid || 0);
          totalRevenue += paid;
          if (paid > 0) {
            recentPayments.push({
              id: doc.id,
              studentName: d.studentName || d.name || 'Student',
              rollNo: d.rollNo || d.studentRollNo || 'N/A',
              amount: paid,
              date: d.paymentDate || d.createdAt || new Date().toISOString(),
              paymentMethod: d.paymentMethod || 'UPI / Cash',
              status: 'COMPLETED',
            });
          }
        });
        recentPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return {
          totalRevenue,
          recentPayments: recentPayments.slice(0, 10),
        };
      } catch (err) {
        console.warn('DashboardService invoice fetch warning:', err);
      }
    }

    return { totalRevenue: 0, recentPayments: [] };
  }

  async getReportsAnalytics(tenantId?: string) {
    const tid = tenantId || 'tenant-test-001';
    return {
      success: true,
      tenantId: tid,
      analytics: {
        totalStudents: 0,
        totalTeachers: 0,
        totalRevenue: 0,
        attendanceRate: 95,
      },
    };
  }

  async getReportsExportData(type: string, tenantId?: string) {
    const tid = tenantId || 'tenant-test-001';
    return {
      success: true,
      tenantId: tid,
      type,
      data: [],
    };
  }
}
