import { Controller, Get, Put, Body, Headers } from '@nestjs/common';
import { SchoolSetupService } from './school-setup.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('School Setup')
@Controller('school-setup')
export class SchoolSetupController {
  constructor(private readonly schoolSetupService: SchoolSetupService) {}

  @Get()
  @ApiOperation({ summary: 'Get school setup configuration' })
  async getSetup(@Headers('X-Tenant-ID') tenantId?: string) {
    return this.schoolSetupService.getSchoolSetup(tenantId);
  }

  @Put()
  @ApiOperation({ summary: 'Update school setup configuration' })
  async updateSetup(@Body() body: any, @Headers('X-Tenant-ID') tenantId?: string) {
    return this.schoolSetupService.updateSchoolSetup(body, tenantId);
  }
}
