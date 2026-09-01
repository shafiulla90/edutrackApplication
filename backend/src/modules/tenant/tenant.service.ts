import { Injectable, NotFoundException, Inject, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { ITenantRepository } from '../../common/interfaces/tenant.repository.interface';
import { IUserRepository } from '../../common/interfaces/user.repository.interface';
import { DashboardStatsService } from '../dashboard/dashboard-stats.service';

@Injectable()
export class TenantService {
  constructor(
    @Inject('ITenantRepository') private readonly tenantRepo: ITenantRepository,
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
    private readonly dashboardStatsService: DashboardStatsService,
    private readonly jwtService: JwtService,
  ) {}

  async registerSchool(data: any) {
    const cleanedPhone = (data.mobileNumber || '').replace(/[\s\-()]/g, '');

    if (typeof this.userRepo.findByPhone === 'function') {
      const existing = await this.userRepo.findByPhone(cleanedPhone);
      if (existing) {
        throw new ConflictException('A school administrator with this mobile number is already registered. Please log in.');
      }
    }

    const tenantId = randomUUID();
    const userId = randomUUID();
    const subDomain = (data.schoolName || 'school').toLowerCase().replace(/[^a-z0-9]/g, '');

    const tenant = await this.tenantRepo.create({
      id: tenantId,
      name: data.schoolName,
      schoolType: data.schoolType || 'School',
      adminName: data.adminName,
      adminPhone: cleanedPhone,
      email: data.email,
      address: data.address || '',
      subDomain,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const user = await this.userRepo.create({
      id: userId,
      tenantId,
      name: data.adminName,
      email: data.email,
      phone: cleanedPhone,
      role: 'SCHOOL_ADMIN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const payload = {
      sub: user.id,
      phone: cleanedPhone,
      role: 'SCHOOL_ADMIN',
      tenantId: tenant.id,
    };

    const token = this.jwtService.sign(payload);

    return {
      success: true,
      access_token: token,
      user: {
        id: user.id,
        phone: cleanedPhone,
        email: user.email,
        name: user.name,
        role: 'SCHOOL_ADMIN',
        tenantId: tenant.id,
        tenant,
      },
    };
  }

  async getSetupStatus(tenantId?: string) {
    const tid = tenantId && tenantId !== 'undefined' && tenantId !== 'null' ? tenantId : 'tenant-test-001';

    // Fetch tenant doc and dashboard stats concurrently using single source of truth
    const [tenant, stats] = await Promise.all([
      this.tenantRepo.findById(tid).catch(() => null),
      this.dashboardStatsService.getTenantStats(tid),
    ]);

    const resolvedTenant = tenant || {
      id: tid,
      name: 'A.P. Greenwood High School',
      schoolType: 'School',
      adminName: 'Sarah Jenkins',
      email: 'apgreenwoodschool@gmail.com',
      adminPhone: '9642402639',
      address: 'Greenwood Campus',
    };

    return {
      success: true,
      currentUser: {
        id: 'user-active',
        name: resolvedTenant.adminName || resolvedTenant.name || 'School Administrator',
        role: 'SCHOOL_ADMIN',
        tenantId: resolvedTenant.id,
      },
      setup: {
        tenantId: resolvedTenant.id,
        schoolName: resolvedTenant.name || 'A.P. Greenwood High School',
        schoolType: resolvedTenant.schoolType || 'School',
        adminName: resolvedTenant.adminName || 'Sarah Jenkins',
        schoolLogo: resolvedTenant.logoUrl || null,
        email: resolvedTenant.email || '',
        mobileNumber: resolvedTenant.adminPhone || resolvedTenant.phone || '',
        address: resolvedTenant.address || '',
        tenant: resolvedTenant,
      },
      subscription: {
        plan: 'PRO',
        status: 'ACTIVE',
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        features: ['all'],
      },
      isSubscriptionActive: true,
      // Single Source of Truth dashboard stats
      studentsCount: stats.studentsCount,
      teachersCount: stats.teachersCount,
      classesCount: stats.classesCount,
      completionPercentage: stats.completionPercentage,
      setupCompleted: stats.setupCompleted,
    };
  }

  async findAll() {
    return this.tenantRepo.findAll();
  }

  async findOne(id: string) {
    const tenant = await this.tenantRepo.findById(id);
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async update(id: string, data: any) {
    return this.tenantRepo.update(id, data);
  }

  async remove(id: string) {
    return this.tenantRepo.delete(id);
  }
}
