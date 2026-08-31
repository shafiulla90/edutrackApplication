import { Controller, Get, Put, Body, Request } from '@nestjs/common';
import { SchoolSetupService } from './school-setup.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { getTenantIdFromReq } from '../../common/utils/tenant.util';

@ApiTags('School Setup')
@Controller('school-setup')
export class SchoolSetupController {
  constructor(private readonly schoolSetupService: SchoolSetupService) {}

  @Get()
  @ApiOperation({ summary: 'Get school setup configuration' })
  async getSetup(@Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.schoolSetupService.getSchoolSetup(tenantId);
  }

  @Put()
  @ApiOperation({ summary: 'Update school setup configuration' })
  async updateSetup(@Body() body: any, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    return this.schoolSetupService.updateSchoolSetup(body, tenantId, userId);
  }
}
