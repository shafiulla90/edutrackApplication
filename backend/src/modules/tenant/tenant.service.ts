import { Injectable, NotFoundException, Inject, ConflictException, Optional } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { ITenantRepository } from '../../common/interfaces/tenant.repository.interface';
import { IUserRepository } from '../../common/interfaces/user.repository.interface';
import { FirebaseService } from '../../database/firebase.service';

@Injectable()
export class TenantService {
  constructor(
    @Inject('ITenantRepository') private readonly tenantRepo: ITenantRepository,
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
    private readonly jwtService: JwtService,
    @Optional() private readonly firebaseService?: FirebaseService,
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

  async getSetupStatus(tenantId: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const tenant = await this.tenantRepo.findById(tenantId);
    const tid = tenantId;

    let classesCount = 0;
    let teachersCount = 0;
    let studentsCount = 0;

    if (this.firebaseService) {
      try {
        const db = this.firebaseService.getFirestore();
        if (db) {
          const [classesSnap, teachersSnap, studentsSnap] = await Promise.all([
            db.collection('tenants').doc(tid).collection('classes').get().catch(() => null),
            db.collection('users').where('tenantId', '==', tid).where('role', 'in', ['TEACHER', 'STAFF', 'DRIVER']).get().catch(() => null),
            db.collection('studentProfiles').where('tenantId', '==', tid).get().catch(() => null),
          ]);

          if (classesSnap && !classesSnap.empty) {
            classesCount = classesSnap.size;
          } else {
            const rootClasses = await db.collection('classes').where('tenantId', '==', tid).get().catch(() => null);
            if (rootClasses) classesCount = rootClasses.size;
          }

          if (teachersSnap) teachersCount = teachersSnap.size;

          if (studentsSnap && !studentsSnap.empty) {
            studentsCount = studentsSnap.size;
          } else {
            const altStudents = await db.collection('users').where('tenantId', '==', tid).where('role', '==', 'STUDENT').get().catch(() => null);
            if (altStudents) studentsCount = altStudents.size;
          }
        }
      } catch (err) {
        console.warn('[getSetupStatus] Count calculation notice:', err);
      }
    }

    let completedSteps = 1;
    if (classesCount > 0) completedSteps++;
    if (teachersCount > 0) completedSteps++;
    if (studentsCount > 0) completedSteps++;
    const completionPercentage = Math.round((completedSteps / 4) * 100);
    const setupCompleted = completionPercentage === 100;

    return {
      success: true,
      classesCount,
      teachersCount,
      studentsCount,
      completionPercentage,
      setupCompleted,
      currentUser: {
        id: 'user-active',
        name: tenant.adminName || tenant.name || 'School Administrator',
        role: 'SCHOOL_ADMIN',
        tenantId: tid,
      },
      setup: {
        tenantId: tid,
        schoolName: tenant.name || 'EduTrack School',
        schoolType: tenant.schoolType || 'School',
        adminName: tenant.adminName || tenant.name || 'School Administrator',
        schoolLogo: tenant.logoUrl || null,
        email: tenant.email || '',
        mobileNumber: tenant.adminPhone || tenant.phone || '',
        address: tenant.address || '',
        classesCount,
        teachersCount,
        studentsCount,
        completionPercentage,
        setupCompleted,
        tenant,
      },
      subscription: {
        plan: 'PRO',
        status: 'ACTIVE',
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        features: ['all'],
      },
      isSubscriptionActive: true,
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
