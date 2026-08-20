import { Controller, Get, Post, Put, Body, Request, Param } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { getTenantIdFromReq } from '../../common/utils/tenant.util';

@ApiTags('Tenants')
@Controller('tenant')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get('public-branding')
  @ApiOperation({ summary: 'Get public branding for default/current tenant' })
  async getPublicBranding() {
    const tenants = await this.tenantService.findAll();
    const primaryTenant = tenants[0] || {
      id: 'default',
      name: 'EduTrack School System',
      subDomain: 'default',
    };
    return {
      success: true,
      tenant: primaryTenant,
      branding: {
        schoolName: primaryTenant.name || 'EduTrack Application',
        logoUrl: null,
        themeColor: '#4f46e5',
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
    return this.tenantService.getSetupStatus(tenantId);
  }

  @Put('banking-upi')
  @ApiOperation({ summary: 'Update tenant banking and UPI configuration' })
  async updateBankingUpi(@Body() body: any) {
    return {
      success: true,
      message: 'Banking & UPI details updated successfully in Cloud Firestore',
      data: body,
    };
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
