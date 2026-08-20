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

  async findOne(id: string, tenantId: string) {
    return this.studentRepo.findProfileById(id);
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
}
