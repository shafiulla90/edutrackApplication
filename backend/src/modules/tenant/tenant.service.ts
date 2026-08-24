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

  private get db() {
    return this.firebaseService ? this.firebaseService.getFirestore() : null;
  }

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

  async getSetupStatus(tenantId?: string, userFromToken?: any) {
    const tid = tenantId && tenantId !== 'undefined' && tenantId !== 'null' ? tenantId : 'tenant-test-001';
    const rawTenant = await this.tenantRepo.findById(tid).catch(() => null);
    const tenant = rawTenant || { id: tid, name: 'EduTrack School', schoolType: 'School', adminName: 'School Administrator', logoUrl: null, email: '', adminPhone: '', phone: '', address: '' };

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

    const adminAvatar = tenant.adminPhoto || tenant.adminAvatarUrl || tenant.avatarUrl || null;

    let currentUserObj = null;
    if (userFromToken && userFromToken.role) {
      const userRole = userFromToken.role;
      const targetUserId = userFromToken.sub || userFromToken.id;
      const targetPhone = userFromToken.phone ? String(userFromToken.phone).replace(/[\s\-()]/g, '') : null;

      let dbUser: any = null;
      let staffProf: any = null;

      if (this.firebaseService) {
        try {
          const db = this.firebaseService.getFirestore();
          if (db) {
            if (targetUserId) {
              const uDoc = await db.collection('users').doc(targetUserId).get().catch(() => null);
              if (uDoc && uDoc.exists) {
                dbUser = { id: uDoc.id, ...uDoc.data() };
              }
            }
            if (!dbUser && targetPhone) {
              const uSnap = await db.collection('users')
                .where('tenantId', '==', tid)
                .where('phone', '==', targetPhone)
                .limit(1).get().catch(() => null);
              if (uSnap && !uSnap.empty) {
                dbUser = { id: uSnap.docs[0].id, ...uSnap.docs[0].data() };
              }
            }
            if (!dbUser && userFromToken.email) {
              const uSnap = await db.collection('users')
                .where('tenantId', '==', tid)
                .where('email', '==', userFromToken.email)
                .limit(1).get().catch(() => null);
              if (uSnap && !uSnap.empty) {
                dbUser = { id: uSnap.docs[0].id, ...uSnap.docs[0].data() };
              }
            }

            const resolvedUserId = dbUser?.id || targetUserId;
            if (resolvedUserId) {
              const spSnap = await db.collection('staffProfiles')
                .where('userId', '==', resolvedUserId)
                .limit(1).get().catch(() => null);
              if (spSnap && !spSnap.empty) {
                staffProf = { id: spSnap.docs[0].id, ...spSnap.docs[0].data() };
              }
            }
          }
        } catch (e) {
          console.warn('[getSetupStatus] User lookup notice:', e);
        }
      }

      const userName = dbUser?.name || staffProf?.name || userFromToken.name || (userRole === 'TEACHER' ? 'Teacher' : userRole === 'PARENT' ? 'Parent User' : (tenant.adminName || 'School Administrator'));
      const userAvatar = dbUser?.avatarUrl || staffProf?.profilePhotoUrl || staffProf?.avatarUrl || (userRole === 'SCHOOL_ADMIN' ? adminAvatar : null);

      currentUserObj = {
        id: dbUser?.id || targetUserId || 'user-active',
        name: userName,
        role: userRole,
        tenantId: dbUser?.tenantId || userFromToken.tenantId || tid,
        avatarUrl: userAvatar,
        phone: dbUser?.phone || userFromToken.phone || staffProf?.phone || '',
        email: dbUser?.email || userFromToken.email || staffProf?.email || '',
      };
    } else {
      currentUserObj = {
        id: 'user-active',
        name: tenant.adminName || tenant.name || 'School Administrator',
        role: 'SCHOOL_ADMIN',
        tenantId: tid,
        avatarUrl: adminAvatar,
      };
    }

    let subDoc: any = null;
    try {
      const snap = await this.db.collection('tenants').doc(tid).collection('subscription').doc('current').get();
      if (snap.exists) subDoc = snap.data();
    } catch (e) {}

    const subStatus = subDoc?.status || 'ACTIVE';
    const subPlan = subDoc?.plan || 'BASIC';
    const subPlanCode = subDoc?.planCode || 'BASIC_6_MONTH';
    const subBillingCycle = subDoc?.billingCycle || '6 Months';
    const subExpiry = subDoc?.expiryDate || new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();

    return {
      currentUser: currentUserObj,
      setup: {
        tenantId: tid,
        schoolName: tenant.name || 'EduTrack School',
        schoolType: tenant.schoolType || 'School',
        adminName: tenant.adminName || tenant.name || 'School Administrator',
        schoolLogo: tenant.logoUrl || null,
        adminPhoto: adminAvatar,
        email: tenant.email || '',
        mobileNumber: tenant.adminPhone || tenant.helpDeskPhone || tenant.phone || '',
        address: tenant.address || '',
        classesCount,
        teachersCount,
        studentsCount,
        completionPercentage,
        setupCompleted,
        tenant,
      },
      subscription: {
        plan: subPlan,
        planCode: subPlanCode,
        planName: subDoc?.planName || 'EduTrack Basic – 6 Months',
        billingCycle: subBillingCycle,
        amount: subDoc?.amount || 1,
        status: subStatus,
        expiryDate: subExpiry,
        features: [
          'Unlimited Students & Staff Profiles',
          'Attendance, Fees & Timetable Management',
          'Exams, Grading & Progress Reports',
          'Parent Portal & In-App Notifications',
          'Transport & Bus GPS Tracking',
        ],
      },
      isSubscriptionActive: subStatus === 'ACTIVE',
    };
  }

  async updateBankingUpi(data: any, tenantId?: string) {
    const tid = tenantId || 'tenant-test-001';
    const updatePayload: any = {
      updatedAt: new Date().toISOString(),
    };

    if (data.bankName !== undefined) updatePayload.bankName = data.bankName;
    if (data.bankAccountNo !== undefined) updatePayload.bankAccountNo = data.bankAccountNo;
    if (data.bankIFSC !== undefined) updatePayload.bankIFSC = data.bankIFSC;
    if (data.bankBranch !== undefined) updatePayload.bankBranch = data.bankBranch;
    if (data.googlePayId !== undefined) updatePayload.googlePayId = data.googlePayId;
    if (data.phonePeId !== undefined) updatePayload.phonePeId = data.phonePeId;
    if (data.upiQrId !== undefined) updatePayload.upiQrId = data.upiQrId;

    const updated = await this.tenantRepo.update(tid, updatePayload);

    return {
      success: true,
      message: 'Banking & UPI configuration updated successfully in Cloud Firestore',
      tenant: updated,
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
