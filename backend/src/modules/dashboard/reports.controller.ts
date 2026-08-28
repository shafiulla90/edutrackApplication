import { Controller, Get, Param, Request } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { getTenantIdFromReq } from '../../common/utils/tenant.util';

@ApiTags('Reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Get real-time reports analytics data' })
  async getReportsAnalytics(@Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.dashboardService.getReportsAnalytics(tenantId);
  }

  @Get(':type')
  @ApiOperation({ summary: 'Export reports analytics data by type' })
  async getReportsExportData(@Param('type') type: string, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.dashboardService.getReportsExportData(type, tenantId);
  }
}
