import { Controller, Get, Post, Put, Body, Request, Param, Query } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { JwtService } from '@nestjs/jwt';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { getTenantIdFromReq } from '../../common/utils/tenant.util';

@ApiTags('Tenants')
@Controller('tenant')
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly jwtService: JwtService,
  ) {}

  @Get('public-branding')
  @ApiOperation({ summary: 'Get public branding for default/current tenant' })
  async getPublicBranding(@Query('phone') phone?: string) {
    let targetTenant = null;
    if (phone) {
      const cleanedPhone = phone.replace(/[\s\-()]/g, '');
      const user = await (this.tenantService as any).userRepo?.findByPhone(cleanedPhone).catch(() => null);
      if (user?.tenantId) {
        targetTenant = await (this.tenantService as any).tenantRepo?.findById(user.tenantId).catch(() => null);
      }
    }
    return {
      success: true,
      tenant: targetTenant || null,
      branding: {
        schoolName: targetTenant ? targetTenant.name : 'EduTrack SaaS Platform',
        logoUrl: targetTenant ? (targetTenant as any).logoUrl || null : null,
        themeColor: targetTenant ? (targetTenant as any).themeColor || '#4f46e5' : '#4f46e5',
      },
    };
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new school tenant and admin' })
  async registerSchool(@Body() body: any) {
    return this.tenantService.registerSchool(body);
  }

  @Get('setup-status')
  @ApiOperation({ summary: 'Get tenant setup status and current user details' })
  async getSetupStatus(@Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    const authHeader = req.headers?.authorization;
    let userFromToken = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        userFromToken = this.jwtService.decode(token);
      } catch (e) {}
    }
    return this.tenantService.getSetupStatus(tenantId, userFromToken);
  }

  @Put('banking-upi')
  @ApiOperation({ summary: 'Update tenant banking and UPI configuration' })
  async updateBankingUpi(@Body() body: any, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.tenantService.updateBankingUpi(body, tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tenants' })
  async findAll() {
    return this.tenantService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tenant by ID' })
  async findOne(@Param('id') id: string) {
    return this.tenantService.findOne(id);
  }
}
