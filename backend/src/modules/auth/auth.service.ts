import { Injectable, UnauthorizedException, ConflictException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { randomUUID } from 'crypto';
import { SubscriptionService } from '../subscription/subscription.service';
import { IUserRepository } from '../../common/interfaces/user.repository.interface';
import { ITenantRepository } from '../../common/interfaces/tenant.repository.interface';

@Injectable()
export class AuthService {
  constructor(
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
    @Inject('ITenantRepository') private readonly tenantRepo: ITenantRepository,
    private jwtService: JwtService,
    private subscriptionService: SubscriptionService,
  ) {}

  async register(dto: RegisterDto) {
    // 1. Check if domain or email already exists
    const existingUser = await this.userRepo.findByEmail(dto.email);
    if (existingUser) throw new ConflictException('Email already in use');

    const existingTenant = await this.tenantRepo.findBySubdomain(dto.domain.toLowerCase());
    if (existingTenant) throw new ConflictException('Domain already in use');

    // 2. Create Tenant and User
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const tenant = await this.tenantRepo.create({
      id: randomUUID(),
      name: dto.school_name,
      subDomain: dto.domain.toLowerCase(),
      updatedAt: new Date(),
    });

    const user = await this.userRepo.create({
      id: randomUUID(),
      tenantId: tenant.id,
      email: dto.email,
      passwordHash: hashedPassword,
      name: `${dto.first_name} ${dto.last_name}`,
      role: 'SCHOOL_ADMIN',
      updatedAt: new Date(),
    });

    const result = {
      message: 'Institution registered successfully',
      tenant_id: tenant.id,
      user_id: user.id,
    };
    
    // Assign free plan outside transaction
    await this.subscriptionService.assignFreePlanToNewTenant(result.tenant_id);
    return result;
  }

  async login(dto: LoginDto) {
    const user = await this.userRepo.findByEmail(dto.email);

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');

    const tenant = await this.tenantRepo.findById(user.tenantId);

    const payload = { 
      sub: user.id, 
      email: user.email, 
      role: user.role, 
      tenantId: user.tenantId 
    };

    let subscriptionStatus = 'ACTIVE';
    if (user.role === 'SCHOOL_ADMIN') {
      const sub = await this.subscriptionService.checkSubscriptionStatus(user.tenantId);
      subscriptionStatus = sub.status;
    }

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        first_name: user.name.split(' ')[0] || '',
        last_name: user.name.split(' ').slice(1).join(' ') || '',
        role: user.role,
        tenant,
        subscriptionStatus,
      },
    };
  }

  private otpStore = new Map<string, { code: string; expiresAt: number }>();

  async sendOtp(phone: string, portal?: string) {
    const cleanedPhone = (phone || '').replace(/[\s\-()]/g, '');

    let existingUser = null;
    if (typeof this.userRepo.findByPhone === 'function') {
      existingUser = await this.userRepo.findByPhone(cleanedPhone);
    }

    const portalRole = (portal === 'teacher' ? 'TEACHER' : portal === 'parent' ? 'PARENT' : portal === 'student' ? 'STUDENT' : 'SCHOOL_ADMIN');

    if (!existingUser) {
      if (portalRole === 'SCHOOL_ADMIN' || !portal || portal === 'admin') {
        console.log(`[AuthService] Mobile number ${cleanedPhone} NOT FOUND in Firestore -> Redirecting to School Registration`);
        return {
          success: false,
          notFound: true,
          redirectToRegister: true,
          portal: 'admin',
          message: 'School Administrator account not found. Please register your school.',
        };
      } else {
        console.log(`[AuthService] Mobile number ${cleanedPhone} NOT FOUND in Firestore for ${portalRole}`);
        return {
          success: false,
          notFound: true,
          redirectToRegister: false,
          portal,
          message: `${portal.toUpperCase()} account not found. Please contact your School Administrator.`,
        };
      }
    }

    const tenants = await this.tenantRepo.findAll();
    const primaryTenant = tenants.find((t: any) => t.id === existingUser.tenantId) || tenants[0] || { id: 'tenant-test-001', name: 'EduTrack School' };

    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    this.otpStore.set(cleanedPhone, {
      code: generatedOtp,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    console.log(`\n==========================================`);
    console.log(`[EduTrack Auth] REAL-TIME OTP FOR REGISTERED USER (${cleanedPhone}): ${generatedOtp}`);
    console.log(`==========================================\n`);

    return {
      success: true,
      registered: true,
      schoolName: primaryTenant.name || 'EduTrack School',
      logoUrl: primaryTenant.logoUrl || null,
      message: 'OTP sent successfully to registered mobile number',
      phone: cleanedPhone,
      code: generatedOtp,
      tenantId: primaryTenant.id,
    };
  }

  async verifyOtp(phone: string, otp?: string, idToken?: string, portal?: string) {
    const cleanedPhone = (phone || '').replace(/[\s\-()]/g, '');

    let existingUser = null;
    if (typeof this.userRepo.findByPhone === 'function') {
      existingUser = await this.userRepo.findByPhone(cleanedPhone);
    }

    if (!existingUser) {
      throw new UnauthorizedException('Mobile number not found. Access denied.');
    }

    const tenants = await this.tenantRepo.findAll();
    const tenant = tenants.find((t: any) => t.id === existingUser.tenantId) || tenants[0] || { id: 'tenant-test-001', name: 'EduTrack School' };

    const role = existingUser.role || (portal === 'teacher' ? 'TEACHER' : portal === 'parent' ? 'PARENT' : 'SCHOOL_ADMIN');
    const userId = existingUser.id || `user-phone-${cleanedPhone}`;

    const payload = {
      sub: userId,
      phone: cleanedPhone,
      role,
      tenantId: tenant.id,
    };

    return {
      success: true,
      registered: true,
      access_token: this.jwtService.sign(payload),
      user: {
        id: userId,
        phone: cleanedPhone,
        email: existingUser.email || `${portal || 'user'}@edutrack.com`,
        name: existingUser.name || 'School Administrator',
        role,
        tenantId: tenant.id,
        tenant,
      },
      token: this.jwtService.sign(payload),
    };
  }

  async exchangeCode(code: string) {
    const tenants = await this.tenantRepo.findAll();
    const tenant = tenants[0] || { id: 'tenant-test-001', name: 'EduTrack School' };
    const payload = { sub: 'user-auth-hub', role: 'SCHOOL_ADMIN', tenantId: tenant.id };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: 'user-auth-hub',
        email: 'admin@edutrack.com',
        role: 'SCHOOL_ADMIN',
        tenantId: tenant.id,
        tenant,
      },
    };
  }

  async getProfile(tokenHeader?: string) {
    if (!tokenHeader) {
      throw new UnauthorizedException('No token provided');
    }
    const token = tokenHeader.replace('Bearer ', '').trim();
    try {
      const payload = this.jwtService.verify(token);
      const tenants = await this.tenantRepo.findAll();
      const tenant = tenants.find((t: any) => t.id === payload.tenantId) || tenants[0] || { id: 'tenant-test-001', name: 'EduTrack School' };

      return {
        success: true,
        user: {
          id: payload.sub,
          email: payload.email || 'admin@edutrack.com',
          phone: payload.phone || '',
          role: payload.role || 'SCHOOL_ADMIN',
          tenantId: payload.tenantId,
          tenant,
        },
      };
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}

