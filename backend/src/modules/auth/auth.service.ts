import { Injectable, UnauthorizedException, ConflictException, Inject, Logger, Optional } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { randomUUID } from 'crypto';
import { SubscriptionService } from '../subscription/subscription.service';
import { IUserRepository } from '../../common/interfaces/user.repository.interface';
import { ITenantRepository } from '../../common/interfaces/tenant.repository.interface';
import { FirebaseService } from '../../database/firebase.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
    @Inject('ITenantRepository') private readonly tenantRepo: ITenantRepository,
    private jwtService: JwtService,
    private subscriptionService: SubscriptionService,
    @Optional() private readonly firebaseService?: FirebaseService,
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

    if (!user.tenantId) {
      throw new UnauthorizedException('School tenant association not found for this user account.');
    }

    let tenant = await this.tenantRepo.findById(user.tenantId).catch(() => null);
    if (!tenant && user.tenant) {
      tenant = user.tenant;
    }
    if (!tenant) {
      tenant = { id: user.tenantId, name: user.name || 'School Portal' };
    }

    const payload = { 
      sub: user.id, 
      email: user.email, 
      role: user.role, 
      tenantId: user.tenantId 
    };

    let subscriptionStatus = 'ACTIVE';
    if (user.role === 'SCHOOL_ADMIN' && user.tenantId) {
      const sub = await this.subscriptionService.checkSubscriptionStatus(user.tenantId).catch(() => ({ status: 'ACTIVE' }));
      subscriptionStatus = sub ? sub.status : 'ACTIVE';
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
    if (!cleanedPhone || cleanedPhone.length < 10) {
      throw new ConflictException('Please enter a valid 10-digit mobile number');
    }

    const generatedOtp = process.env.ALLOW_TEST_OTP === 'true' ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
    this.otpStore.set(cleanedPhone, {
      code: generatedOtp,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    console.log(`\n==========================================`);
    console.log(`[EduTrack Auth] REAL OTP GENERATED FOR (${cleanedPhone}): ${generatedOtp}`);
    console.log(`==========================================\n`);

    // If Fast2SMS or HTTP SMS Provider API key is provided, send real SMS
    const fast2smsKey = process.env.FAST2SMS_API_KEY;
    if (fast2smsKey) {
      try {
        const https = require('https');
        const postData = JSON.stringify({
          route: 'otp',
          variables_values: generatedOtp,
          numbers: cleanedPhone.slice(-10),
        });
        const req = https.request({
          hostname: 'www.fast2sms.com',
          path: '/dev/bulkV2',
          method: 'POST',
          headers: {
            'authorization': fast2smsKey,
            'Content-Type': 'application/json',
            'Content-Length': postData.length,
          },
        });
        req.on('error', (e: any) => this.logger.error('Fast2SMS send error:', e));
        req.write(postData);
        req.end();
      } catch (smsErr) {
        this.logger.error('Failed to dispatch Fast2SMS:', smsErr);
      }
    }

    return {
      success: true,
      registered: true,
      schoolName: 'EduTrack SaaS Platform',
      message: 'OTP sent successfully to mobile number',
      phone: cleanedPhone,
      code: process.env.ALLOW_TEST_OTP === 'true' ? generatedOtp : undefined,
    };
  }

  async verifyOtp(phone: string, otp?: string, idToken?: string, portal?: string) {
    const cleanedPhone = (phone || '').replace(/[\s\-()]/g, '');

    // Step 1: Validate OTP against stored code, valid token, or valid 6-digit code
    const storedOtp = this.otpStore.get(cleanedPhone);
    const inputCode = (otp || idToken || '').trim();

    let isValidOtp = false;
    if (storedOtp && storedOtp.code === inputCode && storedOtp.expiresAt > Date.now()) {
      isValidOtp = true;
      this.otpStore.delete(cleanedPhone);
    } else if (storedOtp && inputCode.endsWith(storedOtp.code) && storedOtp.expiresAt > Date.now()) {
      isValidOtp = true;
      this.otpStore.delete(cleanedPhone);
    } else if (inputCode === '123456' && process.env.ALLOW_TEST_OTP === 'true') {
      isValidOtp = true;
    } else if (idToken && idToken.length > 20 && this.firebaseService) {
      try {
        const decodedToken = await this.firebaseService.getAuth().verifyIdToken(idToken);
        const decodedPhone = (decodedToken.phone_number || '').replace(/[\s\-()]/g, '');
        const normDecoded = decodedPhone.slice(-10);
        const normInput = cleanedPhone.slice(-10);
        if (normDecoded && normInput && normDecoded === normInput) {
          isValidOtp = true;
        }
      } catch (err) {
        this.logger.error('Firebase ID token verification failed:', err);
      }
    }

    if (!isValidOtp) {
      throw new UnauthorizedException('Invalid or expired OTP code. Please try again.');
    }

    // Step 2: AFTER OTP IS VERIFIED, check database for registered user
    let existingUser = null;
    if (typeof this.userRepo.findByPhone === 'function') {
      existingUser = await this.userRepo.findByPhone(cleanedPhone, portal).catch(() => null);
    }
    if (!existingUser && typeof (this.userRepo as any).findAnyUserByPhone === 'function') {
      existingUser = await (this.userRepo as any).findAnyUserByPhone(cleanedPhone).catch(() => null);
    }

    // Unregistered User: OTP is valid, but no user account exists
    if (!existingUser) {
      return {
        success: true,
        registered: false,
        notFound: true,
        message: 'Account not found for this mobile number. Please register to continue.',
      };
    }

    // Registered User: Fetch strict user-tenant mapping
    let tenantId = existingUser.tenantId;

    let tenant = tenantId ? await this.tenantRepo.findById(tenantId).catch(() => null) : null;

    if (!tenant && existingUser.tenant) {
      tenant = existingUser.tenant;
      tenantId = tenant.id;
    }

    if (!tenant && (existingUser.role === 'SUPER_ADMIN' || existingUser.role === 'PLATFORM_ADMIN')) {
      tenantId = tenantId || 'platform';
      tenant = { id: tenantId, name: 'Platform Admin' };
    }

    // Try finding tenant specifically matching the user's admin phone
    if (!tenant && typeof (this.tenantRepo as any).findAll === 'function') {
      try {
        const allTenants = await this.tenantRepo.findAll();
        const matchedTenant = allTenants.find((t: any) => 
          (t.adminPhone && t.adminPhone.slice(-10) === cleanedPhone.slice(-10)) ||
          (t.phone && t.phone.slice(-10) === cleanedPhone.slice(-10))
        );
        if (matchedTenant) {
          tenant = matchedTenant;
          tenantId = matchedTenant.id;
        }
      } catch (err) {
        this.logger.warn('Tenant lookup by phone failed:', err);
      }
    }

    if (!tenant && tenantId) {
      tenant = {
        id: tenantId,
        name: existingUser.schoolName || 'School Portal',
      };
    }

    if (!tenant || !tenantId) {
      throw new UnauthorizedException('School tenant association not found for this user account.');
    }

    const payload = {
      sub: existingUser.id,
      phone: cleanedPhone,
      email: existingUser.email,
      role: existingUser.role,
      tenantId: tenantId,
    };

    return {
      success: true,
      registered: true,
      access_token: this.jwtService.sign(payload),
      user: {
        ...existingUser,
        tenantId: tenantId,
        tenant,
      },
    };
  }

  async exchangeCode(code: string) {
    throw new UnauthorizedException('Code exchange is deprecated. Please authenticate via mobile number and OTP.');
  }

  async getProfile(tokenHeader?: string) {
    if (!tokenHeader) {
      throw new UnauthorizedException('No token provided');
    }
    const token = tokenHeader.replace('Bearer ', '').trim();
    try {
      const payload = this.jwtService.verify(token);
      let tenant = null;
      if (payload.tenantId) {
        tenant = await this.tenantRepo.findById(payload.tenantId).catch(() => null);
      }
      if (!tenant && (payload.role === 'SUPER_ADMIN' || payload.role === 'PLATFORM_ADMIN')) {
        tenant = { id: payload.tenantId || 'platform', name: 'Platform Admin' };
      }
      if (!tenant && payload.tenantId) {
        tenant = { id: payload.tenantId, name: 'School Portal' };
      }
      if (!tenant) {
        throw new UnauthorizedException('School tenant association not found for user');
      }

      return {
        success: true,
        user: {
          id: payload.sub,
          email: payload.email || '',
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


