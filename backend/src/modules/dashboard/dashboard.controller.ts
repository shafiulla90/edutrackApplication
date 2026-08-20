import { Controller, Get, Param, Request } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { getTenantIdFromReq } from '../../common/utils/tenant.util';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get live dashboard summary & statistics' })
  async getDashboardSummary(@Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.dashboardService.getDashboardSummary(tenantId);
  }

  @Get('reports')
  @ApiOperation({ summary: 'Get real-time reports analytics data' })
  async getReportsAnalytics(@Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.dashboardService.getReportsAnalytics(tenantId);
  }

  @Get('reports/:type')
  @ApiOperation({ summary: 'Export reports analytics data by type' })
  async getReportsExportData(@Param('type') type: string, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.dashboardService.getReportsExportData(type, tenantId);
  }
}
