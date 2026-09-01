import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { ITeacherRepository } from '../../common/interfaces/teacher.repository.interface';
import { IUserRepository } from '../../common/interfaces/user.repository.interface';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TeacherService {
  constructor(
    @Inject('ITeacherRepository') private readonly teacherRepo: ITeacherRepository,
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
  ) {}

  async reconcile(tenantId: string) {
    return this.teacherRepo.reconcileLegacyTeachers(tenantId);
  }

  async create(tenantId: string, data: any) {
    const tid = tenantId || 'tenant-test-001';

    // Extract & trim fields
    const firstName = (data.firstName || '').trim();
    const lastName = (data.lastName || '').trim();
    const email = (data.email || '').trim();
    const phone = (data.phone || '').trim();
    const designation = (data.designation || '').trim();
    const department = (data.department || '').trim();
    const staffType = data.staffType || 'Teaching';

    // Strict validation
    if (!firstName) {
      throw new BadRequestException('First Name is required.');
    }
    if (!lastName) {
      throw new BadRequestException('Last Name is required.');
    }
    if (!email || !email.includes('@')) {
      throw new BadRequestException('A valid Email address is required.');
    }
    if (!phone) {
      throw new BadRequestException('Mobile Phone is required.');
    }
    if (!designation) {
      throw new BadRequestException('Designation is required.');
    }

    const salary = Number(data.basicSalary);
    if (
      data.basicSalary === undefined ||
      data.basicSalary === null ||
      data.basicSalary === '' ||
      !Number.isFinite(salary) ||
      salary <= 0
    ) {
      throw new BadRequestException('Basic Salary is required and must be greater than 0.');
    }

    const subjectsTaught = Array.isArray(data.subjectsTaught)
      ? data.subjectsTaught.filter((s: any) => s && String(s).trim())
      : [];

    if (staffType === 'Teaching' && subjectsTaught.length === 0) {
      throw new BadRequestException('At least one Subject Skill is required for Teaching Faculty.');
    }

    if (staffType === 'Non-Teaching' && !department) {
      throw new BadRequestException('Department is required for Non-Teaching Staff.');
    }

    const fullName = `${firstName} ${lastName}`.trim() || (data.name || '').trim();
    const role = staffType === 'Non-Teaching' ? 'STAFF' : 'TEACHER';

    // Check if user with email already exists
    const existingUser = await this.userRepo.findByEmail(email);
    if (existingUser) {
      throw new BadRequestException('A user with this email already exists.');
    }

    // Generate IDs
    const userId = randomUUID();
    const staffProfileId = randomUUID();

    // Hash a default password (phone or 'edutrack123')
    const defaultPassword = phone || 'edutrack123';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    // 1. Create User
    await this.userRepo.create({
      id: userId,
      email,
      passwordHash,
      name: fullName,
      role,
      phone: phone || null,
      isActive: true,
      tenantId: tid,
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
      tenantId: tid,
      employeeId: data.employeeId || (designation.toUpperCase().substring(0, 3) + '-' + Math.floor(100 + Math.random() * 900)),
      designation,
      department: department || null,
      qualification: data.qualification || null,
      joiningDate: safeJoiningDate,
      status: data.status || 'Active',
      basicSalary: salary,
      allowances: data.allowances !== undefined && data.allowances !== null && !isNaN(Number(data.allowances)) ? Number(data.allowances) : 0,
      pfDeduction: data.pfDeduction !== undefined && data.pfDeduction !== null && !isNaN(Number(data.pfDeduction)) ? Number(data.pfDeduction) : 0,
      subjectsTaught,
    });

    return {
      id: staffProfileId,
      userId,
      name: fullName,
      role,
      staffType,
      tenantId: tid,
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
}
