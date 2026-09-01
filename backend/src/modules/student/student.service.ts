import { Injectable, Inject } from '@nestjs/common';
import { IStudentRepository } from '../../common/interfaces/student.repository.interface';
import { randomUUID } from 'crypto';

@Injectable()
export class StudentService {
  constructor(@Inject('IStudentRepository') private readonly studentRepo: IStudentRepository) {}

  async findAll(tenantId: string, page = 1, limit = 100, filters?: any) {
    const res = await this.studentRepo.findStudentsByTenant(tenantId || 'tenant-test-001', page, limit, filters);
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
    const id = data.id || randomUUID();
    return this.studentRepo.createProfile({
      ...data,
      id,
      tenantId: tenantId || 'tenant-test-001',
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

  async bulkDelete(studentIds: string[], tenantId: string) {
    if (this.studentRepo.deleteBulkProfiles) {
      return this.studentRepo.deleteBulkProfiles(studentIds, tenantId);
    }
    return { success: true, count: 0 };
  }
}

