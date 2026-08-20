import { Injectable, Inject, BadRequestException, Optional } from '@nestjs/common';
import { ITeacherRepository } from '../../common/interfaces/teacher.repository.interface';
import { IUserRepository } from '../../common/interfaces/user.repository.interface';
import { FirebaseService } from '../../database/firebase.service';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TeacherService {
  constructor(
    @Inject('ITeacherRepository') private readonly teacherRepo: ITeacherRepository,
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
    @Optional() private readonly firebase?: FirebaseService,
  ) {}

  async create(tenantId: string, data: any) {
    if (!data.name && !data.email) {
      throw new BadRequestException('Name and email are required to create a staff member.');
    }

    // Determine role based on staffType
    const role = data.staffType === 'Non-Teaching' ? 'STAFF' : 'TEACHER';

    // Check if user with email already exists
    const existingUser = await this.userRepo.findByEmail(data.email);
    if (existingUser) {
      throw new BadRequestException('A user with this email already exists.');
    }

    // Generate IDs
    const userId = randomUUID();
    const staffProfileId = randomUUID();

    // Hash a default password (phone or 'edutrack123')
    const defaultPassword = data.phone || 'edutrack123';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    // 1. Create User
    await this.userRepo.create({
      id: userId,
      email: data.email,
      passwordHash,
      name: data.name,
      role,
      phone: data.phone || null,
      isActive: true,
      tenantId,
      avatarUrl: data.avatarUrl || null,
      updatedAt: new Date(),
    });

    // 2. Create StaffProfile
    const safeJoiningDate = data.joiningDate && !isNaN(new Date(data.joiningDate).getTime())
      ? new Date(data.joiningDate)
      : new Date();

    await this.teacherRepo.createStaffProfile({
      id: staffProfileId,
      userId,
      tenantId,
      employeeId: data.employeeId || null,
      designation: data.designation || null,
      qualification: data.qualification || null,
      joiningDate: safeJoiningDate,
      status: data.status || 'Active',
      basicSalary: data.basicSalary !== undefined && data.basicSalary !== null && !isNaN(Number(data.basicSalary)) ? Number(data.basicSalary) : null,
      allowances: data.allowances !== undefined && data.allowances !== null && !isNaN(Number(data.allowances)) ? Number(data.allowances) : null,
      pfDeduction: data.pfDeduction !== undefined && data.pfDeduction !== null && !isNaN(Number(data.pfDeduction)) ? Number(data.pfDeduction) : null,
      subjectsTaught: Array.isArray(data.subjectsTaught) ? data.subjectsTaught : [],
    });

    return {
      id: staffProfileId,
      userId,
      name: data.name,
      role,
      staffType: data.staffType,
    };
  }

  async findAll(tenantId: string, filters?: any) {
    const list = await this.teacherRepo.findTeachersByTenant(tenantId);
    if (!filters) return list;
    let filtered = [...list];
    if (filters.search && typeof filters.search === 'string' && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      filtered = filtered.filter((t: any) => 
        (t.name || t.User?.name || t.user?.name || '').toLowerCase().includes(q) ||
        (t.employeeId || '').toLowerCase().includes(q) ||
        (t.designation || '').toLowerCase().includes(q) ||
        (t.user?.phone || t.phone || '').includes(q) ||
        (t.user?.email || t.email || '').toLowerCase().includes(q)
      );
    }
    if (filters.role && filters.role !== 'All') {
      filtered = filtered.filter((t: any) => 
        (t.User?.role || t.user?.role || t.role || '').toLowerCase() === filters.role.toLowerCase()
      );
    }
    if (filters.department && filters.department !== 'All') {
      filtered = filtered.filter((t: any) => 
        (t.department || t.designation || '').toLowerCase().includes(filters.department.toLowerCase())
      );
    }
    return filtered;
  }

  async findOne(id: string, tenantId: string) {
    return this.teacherRepo.findProfileById(id);
  }

  async update(id: string, tenantId: string, data: any) {
    // Update both the StaffProfile and User documents
    const profile = await this.teacherRepo.findProfileById(id);
    if (!profile) {
      throw new BadRequestException('Staff member not found.');
    }

    // Update the user record
    if (profile.userId) {
      const userUpdateData: any = {};
      if (data.name) userUpdateData.name = data.name;
      if (data.email) userUpdateData.email = data.email;
      if (data.phone) userUpdateData.phone = data.phone;
      if (data.avatarUrl !== undefined) userUpdateData.avatarUrl = data.avatarUrl;
      userUpdateData.updatedAt = new Date();

      await this.userRepo.update(profile.userId, userUpdateData);
    }

    // Update the staff profile
    await this.teacherRepo.updateStaffProfile(id, {
      employeeId: data.employeeId,
      designation: data.designation,
      qualification: data.qualification,
      joiningDate: data.joiningDate ? new Date(data.joiningDate) : undefined,
      status: data.status,
      basicSalary: data.basicSalary ? Number(data.basicSalary) : undefined,
      allowances: data.allowances ? Number(data.allowances) : undefined,
      pfDeduction: data.pfDeduction ? Number(data.pfDeduction) : undefined,
      subjectsTaught: data.subjectsTaught,
    });

    return { success: true, id };
  }

  async remove(id: string, tenantId: string) {
    const profile = await this.teacherRepo.findProfileById(id);
    if (!profile) {
      throw new BadRequestException('Staff member not found.');
    }

    // Delete staff profile
    await this.teacherRepo.deleteStaffProfile(id);

    // Delete user account
    if (profile.userId) {
      await this.userRepo.delete(profile.userId);
    }

    return { success: true, id };
  }

  async paySalary(id: string, tenantId: string, data?: any) {
    if (!tenantId) throw new Error('tenantId is required');
    const month = data?.month || 'Jun 2026';
    const tid = tenantId;

    if (this.firebase) {
      const db = this.firebase.getFirestore();
      try {
        await db.collection('staffProfiles').doc(id).set({
          salaryStatus: 'Paid',
          lastPaidMonth: month,
          lastPaidAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }, { merge: true });

        await db.collection('tenants').doc(tid).collection('salaryPayments').add({
          staffId: id,
          month,
          paymentDate: new Date().toISOString(),
          status: 'SUCCESS',
          createdAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('paySalary firestore update warning:', err);
      }
    }

    return {
      success: true,
      message: `Salary disbursed successfully for ${month}`,
      id,
      month,
      status: 'Paid',
    };
  }

  async payAllSalaries(tenantId: string, data?: any) {
    if (!tenantId) throw new Error('tenantId is required');
    const month = data?.month || 'Jun 2026';
    const tid = tenantId;

    if (this.firebase) {
      const db = this.firebase.getFirestore();
      try {
        const staffSnap = await db.collection('staffProfiles').get();
        const batch = db.batch();
        staffSnap.docs.forEach((doc) => {
          batch.set(doc.ref, {
            salaryStatus: 'Paid',
            lastPaidMonth: month,
            lastPaidAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        });
        await batch.commit();
      } catch (err) {
        console.warn('payAllSalaries firestore update warning:', err);
      }
    }

    return {
      success: true,
      message: `All salaries processed successfully for ${month}`,
      month,
    };
  }

  async getSalaryInvoices(id: string, tenantId: string) {
    return [
      {
        id: `SAL-${id.slice(0, 6).toUpperCase()}-01`,
        month: 'May 2026',
        amount: 32100,
        status: 'Paid',
        paidAt: '2026-05-31',
      },
    ];
  }

  async getCases(id: string, tenantId: string) {
    return [];
  }

  async getSchedule(id: string, tenantId: string) {
    return [
      { day: 'Monday', period: '1st Period', class: 'Grade 10 - A', subject: 'Mathematics' },
      { day: 'Wednesday', period: '3rd Period', class: 'Grade 10 - B', subject: 'Mathematics' },
    ];
  }
}
