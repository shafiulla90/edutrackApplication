import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../database/firebase.service';

@Injectable()
export class LeaveManagementService {
  constructor(private readonly firebaseService: FirebaseService) {}

  private get db() {
    return this.firebaseService.getFirestore();
  }

  private async ensureSeeded(tenantId: string) {
    const tid = tenantId || 'tenant-test-001';
    const leavesRef = this.db.collection('tenants').doc(tid).collection('leaveRequests');
    const snap = await leavesRef.limit(1).get();

    if (snap.empty) {
      const today = new Date().toISOString().split('T')[0];
      const initialLeaves = [
        {
          id: 'leave-seed-001',
          tenantId: tid,
          applicantType: 'TEACHER',
          leaveType: 'Casual',
          startDate: '2026-08-22',
          endDate: '2026-08-23',
          reason: 'Attending family function in native village',
          status: 'PENDING',
          appliedDate: today,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          teacherId: 'teacher-001',
          teacher: {
            id: 'teacher-001',
            user: { name: 'Sarah Jenkins', email: 'sarah.jenkins@school.com' },
            employeeId: 'EMP-101',
            department: 'Mathematics',
          },
        },
        {
          id: 'leave-seed-002',
          tenantId: tid,
          applicantType: 'STUDENT',
          leaveType: 'Medical',
          startDate: '2026-08-21',
          endDate: '2026-08-23',
          reason: 'High fever and doctor advised rest for 3 days',
          status: 'PENDING',
          appliedDate: today,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          studentId: '2f07f05a-e5b7-445c-b08e-a5b7d469907c',
          student: {
            id: '2f07f05a-e5b7-445c-b08e-a5b7d469907c',
            user: { name: 'Mohamd huzaifa', email: 'huzaifa@student.com' },
            rollNo: 'STU-6901',
            classSection: {
              class: { name: 'Class-1' },
              section: { name: 'Section-A' },
            },
          },
        },
        {
          id: 'leave-seed-003',
          tenantId: tid,
          applicantType: 'TEACHER',
          leaveType: 'Medical',
          startDate: '2026-08-20',
          endDate: '2026-08-20',
          reason: 'Dental appointment and root canal procedure',
          status: 'APPROVED',
          approver: 'School Administrator',
          approvedDate: today,
          appliedDate: '2026-08-19',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          teacherId: 'teacher-002',
          teacher: {
            id: 'teacher-002',
            user: { name: 'John Smith', email: 'john.smith@school.com' },
            employeeId: 'EMP-102',
            department: 'Science',
          },
        },
        {
          id: 'leave-seed-004',
          tenantId: tid,
          applicantType: 'STUDENT',
          leaveType: 'Emergency',
          startDate: '2026-08-19',
          endDate: '2026-08-19',
          reason: 'Family urgent trip out of station',
          status: 'REJECTED',
          approver: 'School Administrator',
          rejectedDate: today,
          remarks: 'Prior notice required for personal travel',
          appliedDate: '2026-08-18',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          studentId: '88ca002a-5893-43d0-891a-c0028839dd02',
          student: {
            id: '88ca002a-5893-43d0-891a-c0028839dd02',
            user: { name: 'Student 1', email: 'student1@school.com' },
            rollNo: 'STU-1000',
            classSection: {
              class: { name: 'Class-1' },
              section: { name: 'Section-A' },
            },
          },
        },
        {
          id: 'leave-seed-005',
          tenantId: tid,
          applicantType: 'STUDENT',
          leaveType: 'Casual',
          startDate: '2026-08-25',
          endDate: '2026-08-26',
          reason: 'Attending sibling wedding ceremony',
          status: 'PENDING',
          appliedDate: today,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          studentId: '4f59593b-c4d6-4f09-967d-8fbd4df9926e',
          student: {
            id: '4f59593b-c4d6-4f09-967d-8fbd4df9926e',
            user: { name: 'QA Final Student', email: 'qastudent@school.com' },
            rollNo: 'STU-QA-999',
            classSection: {
              class: { name: 'Class-2' },
              section: { name: 'Section-A' },
            },
          },
        },
      ];

      const batch = this.db.batch();
      for (const item of initialLeaves) {
        const ref = leavesRef.doc(item.id);
        batch.set(ref, item);
      }
      await batch.commit();
    }
  }

  async getLeaveApplications(tenantId: string, query: any) {
    const tid = tenantId || 'tenant-test-001';
    await this.ensureSeeded(tid);

    const leavesRef = this.db.collection('tenants').doc(tid).collection('leaveRequests');
    const snap = await leavesRef.get();

    let items: any[] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Status filter
    if (query.status && query.status !== 'ALL') {
      const targetStatus = query.status.toUpperCase();
      items = items.filter(item => (item.status || 'PENDING').toUpperCase() === targetStatus);
    }

    // Applicant type filter
    if (query.applicantType && query.applicantType !== 'ALL') {
      const targetType = query.applicantType.toUpperCase();
      items = items.filter(item => {
        const itemType = (item.applicantType || (item.student ? 'STUDENT' : 'TEACHER')).toUpperCase();
        return itemType === targetType;
      });
    }

    // Leave type filter
    if (query.leaveType && query.leaveType !== 'ALL') {
      items = items.filter(item => item.leaveType === query.leaveType);
    }

    // Date filters
    if (query.startDate) {
      items = items.filter(item => item.startDate >= query.startDate);
    }
    if (query.endDate) {
      items = items.filter(item => item.endDate <= query.endDate);
    }

    // Search filter
    if (query.search) {
      const term = query.search.toLowerCase();
      items = items.filter(item => {
        const applicantName = (item.teacher?.user?.name || item.student?.user?.name || item.applicantName || '').toLowerCase();
        const empId = (item.teacher?.employeeId || item.student?.rollNo || '').toLowerCase();
        const reason = (item.reason || '').toLowerCase();
        return applicantName.includes(term) || empId.includes(term) || reason.includes(term);
      });
    }

    // Sorting
    const sortBy = query.sortBy || 'appliedDate';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    items.sort((a, b) => {
      let valA = a[sortBy] || a.createdAt || '';
      let valB = b[sortBy] || b.createdAt || '';
      if (sortBy === 'applicantName') {
        valA = a.teacher?.user?.name || a.student?.user?.name || '';
        valB = b.teacher?.user?.name || b.student?.user?.name || '';
      }
      if (valA < valB) return -1 * sortOrder;
      if (valA > valB) return 1 * sortOrder;
      return 0;
    });

    // Pagination
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const total = items.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedItems = items.slice(startIndex, startIndex + limit);

    return {
      data: paginatedItems,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async getLeaveStats(tenantId: string) {
    const tid = tenantId || 'tenant-test-001';
    await this.ensureSeeded(tid);

    const snap = await this.db.collection('tenants').doc(tid).collection('leaveRequests').get();
    const items = snap.docs.map(doc => doc.data());

    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonthStr = todayStr.substring(0, 7);
    const currentYearStr = todayStr.substring(0, 4);

    let pending = 0;
    let approvedToday = 0;
    let rejectedToday = 0;
    let totalThisMonth = 0;
    let totalThisYear = 0;

    for (const item of items) {
      const st = (item.status || 'PENDING').toUpperCase();
      if (st === 'PENDING') pending++;

      const isApprovedToday = st === 'APPROVED' && (item.approvedDate === todayStr || (item.updatedAt && item.updatedAt.startsWith(todayStr)));
      if (isApprovedToday) approvedToday++;

      const isRejectedToday = st === 'REJECTED' && (item.rejectedDate === todayStr || (item.updatedAt && item.updatedAt.startsWith(todayStr)));
      if (isRejectedToday) rejectedToday++;

      const applied = item.appliedDate || item.startDate || item.createdAt || '';
      if (applied.startsWith(currentMonthStr)) totalThisMonth++;
      if (applied.startsWith(currentYearStr)) totalThisYear++;
    }

    return {
      pending,
      approvedToday,
      rejectedToday,
      totalThisMonth,
      totalThisYear,
    };
  }

  async createLeave(tenantId: string, body: any, user?: any) {
    const tid = tenantId || 'tenant-test-001';
    const leavesRef = this.db.collection('tenants').doc(tid).collection('leaveRequests');
    const docRef = leavesRef.doc();
    const today = new Date().toISOString().split('T')[0];

    const isTeacher = !body.studentId;
    const userName = user?.name || user?.email || (isTeacher ? 'Staff Member' : 'Student');

    const newLeave: any = {
      id: docRef.id,
      tenantId: tid,
      applicantType: isTeacher ? 'TEACHER' : 'STUDENT',
      leaveType: body.leaveType || 'Casual',
      startDate: body.startDate || today,
      endDate: body.endDate || today,
      reason: body.reason || 'Leave requested',
      status: 'PENDING',
      appliedDate: today,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isTeacher) {
      newLeave.teacherId = user?.id || 'staff-001';
      newLeave.teacher = {
        id: user?.id || 'staff-001',
        user: { name: userName, email: user?.email || 'staff@school.com' },
        employeeId: 'EMP-STAFF',
        department: 'General Staff',
      };
    } else {
      newLeave.studentId = body.studentId;
      newLeave.student = {
        id: body.studentId,
        user: { name: body.studentName || 'Student', email: 'student@school.com' },
        rollNo: body.rollNo || 'STU-101',
        classSection: {
          class: { name: body.className || 'Class-1' },
          section: { name: body.sectionName || 'Section-A' },
        },
      };
    }

    await docRef.set(newLeave);
    return newLeave;
  }

  async updateStatus(tenantId: string, id: string, status: string, comments?: string, approverName?: string) {
    const tid = tenantId || 'tenant-test-001';
    const docRef = this.db.collection('tenants').doc(tid).collection('leaveRequests').doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      throw new Error(`Leave request ${id} not found`);
    }

    const leaveData = snap.data() || {};
    const normStatus = status.toUpperCase() === 'APPROVED' ? 'APPROVED' : (status.toUpperCase() === 'REJECTED' ? 'REJECTED' : status);
    const today = new Date().toISOString().split('T')[0];

    const updateData: any = {
      status: normStatus,
      updatedAt: new Date().toISOString(),
      approver: approverName || 'Administrator',
      approvedBy: approverName || 'Administrator',
      approvedRole: 'Administrator',
      remarks: comments || '',
      comments: comments || '',
    };

    if (normStatus === 'APPROVED') {
      updateData.approvedDate = today;
    } else if (normStatus === 'REJECTED') {
      updateData.rejectedDate = today;
    }

    await docRef.update(updateData);

    // If this is a student leave request, push notification for the parent
    if (leaveData.studentId || leaveData.applicantType === 'STUDENT') {
      try {
        const studentName = leaveData.studentName || leaveData.student?.user?.name || leaveData.student?.name || 'Student';
        const notifRef = this.db.collection('notifications').doc();
        await notifRef.set({
          id: notifRef.id,
          tenantId: tid,
          studentId: leaveData.studentId || '',
          recipientId: leaveData.parentId || leaveData.studentId || 'user-header',
          type: 'LEAVE_STATUS',
          title: `Leave Application ${normStatus === 'APPROVED' ? 'Approved' : 'Rejected'}`,
          message: `Leave application for ${studentName} has been ${normStatus.toLowerCase()}.`,
          isRead: false,
          createdAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Failed to create leave notification:', err);
      }
    }

    return { success: true, id, status: normStatus };
  }

  async bulkUpdateStatus(tenantId: string, ids: string[], status: string, comments?: string, approverName?: string) {
    const tid = tenantId || 'tenant-test-001';
    const batch = this.db.batch();
    const normStatus = status.toUpperCase() === 'APPROVED' ? 'APPROVED' : (status.toUpperCase() === 'REJECTED' ? 'REJECTED' : status);
    const today = new Date().toISOString().split('T')[0];

    for (const id of ids) {
      const docRef = this.db.collection('tenants').doc(tid).collection('leaveRequests').doc(id);
      const updateData: any = {
        status: normStatus,
        updatedAt: new Date().toISOString(),
        approver: approverName || 'Administrator',
        approvedBy: approverName || 'Administrator',
        approvedRole: 'Administrator',
        remarks: comments || '',
        comments: comments || '',
      };
      if (normStatus === 'APPROVED') updateData.approvedDate = today;
      if (normStatus === 'REJECTED') updateData.rejectedDate = today;
      batch.update(docRef, updateData);
    }

    await batch.commit();
    return { success: true, count: ids.length, status: normStatus };
  }

  async getHistory(tenantId: string, applicantType: string, applicantId: string) {
    const tid = tenantId || 'tenant-test-001';
    await this.ensureSeeded(tid);

    const leavesRef = this.db.collection('tenants').doc(tid).collection('leaveRequests');
    const snap = await leavesRef.get();

    const normType = applicantType.toUpperCase();
    const items = snap.docs
      .map(doc => doc.data())
      .filter(item => {
        const itemType = (item.applicantType || (item.student ? 'STUDENT' : 'TEACHER')).toUpperCase();
        const itemId = itemType === 'STUDENT' ? item.studentId : item.teacherId;
        return itemType === normType && (itemId === applicantId || item.id === applicantId);
      });

    return items;
  }

  async deleteLeave(tenantId: string, id: string) {
    const tid = tenantId || 'tenant-test-001';
    await this.db.collection('tenants').doc(tid).collection('leaveRequests').doc(id).delete();
    return { success: true, id };
  }
}
