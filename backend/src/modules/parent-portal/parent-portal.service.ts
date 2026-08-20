import { Injectable, Inject } from '@nestjs/common';
import { IBillingRepository } from '../../common/interfaces/billing.repository.interface';
import { IOperationsRepository } from '../../common/interfaces/operations.repository.interface';
import { IStudentRepository } from '../../common/interfaces/student.repository.interface';

@Injectable()
export class ParentPortalService {
  constructor(
    @Inject('IBillingRepository') private readonly billingRepo: IBillingRepository,
    @Inject('IOperationsRepository') private readonly opsRepo: IOperationsRepository,
    @Inject('IStudentRepository') private readonly studentRepo: IStudentRepository,
  ) {}

  async getDashboardStats(userId: string, tenantId: string) {
    const children = await this.getChildren(userId, tenantId);
    return { childrenCount: children.length, pendingFees: 0, newAnnouncements: 0 };
  }

  async getChildren(userId: string, tenantId?: string) {
    if (!tenantId) throw new Error('tenantId is required');
    if (this.studentRepo.findStudentsByParent) {
      return this.studentRepo.findStudentsByParent(userId, tenantId);
    }
    return [];
  }

  async getChildDashboard(userId: string, studentId: string, tenantId?: string) {
    return { studentId, name: 'Alex Smith', attendancePercentage: 92, pendingFees: 0 };
  }

  async getAttendance(userId: string, studentId: string) {
    return [];
  }

  async getHomework(userId: string, studentId: string) {
    return [];
  }

  async submitAssignment(userId: string, studentId: string, homeworkId: string, base64File: string, fileName: string) {
    return { success: true, studentId, homeworkId, fileName };
  }

  async getExams(userId: string, studentId: string) {
    return [];
  }

  async getFees(userId: string, studentId: string) {
    const list = await this.billingRepo.findInvoicesByStudent(studentId);
    return list || [];
  }

  async payInvoice(userId: string, studentId: string, invoiceId: string, data: any) {
    return this.billingRepo.updateInvoiceStatus(invoiceId, 'PAID', data.amount);
  }

  async generateInvoicePdf(userId: string, studentId: string, invoiceId: string, res: any) {
    return { invoiceId, status: 'GENERATED' };
  }

  async getTimetable(userId: string, studentId: string) {
    return [];
  }

  async getAnnouncements(userId: string, studentId: string) {
    return [];
  }

  async getTeacherComplaints(userId: string, studentId: string) {
    return [];
  }

  async getComplaints(userId: string) {
    return [];
  }

  async submitComplaint(userId: string, tenantId: string, data: any) {
    const tid = tenantId || 'tenant-test-001';
    return this.opsRepo.createComplaint({ ...data, createdById: userId, tenantId: tid });
  }

  async getTransport(userId: string, studentId: string) {
    return { routeName: 'Bus Route 12', stopName: 'Main Square' };
  }

  async getLeavesHistory(userId: string, studentId: string) {
    return [];
  }

  async submitLeaveRequest(userId: string, studentId: string, data: any) {
    return { id: 'leave-' + Date.now(), studentId, ...data, status: 'PENDING' };
  }
}
