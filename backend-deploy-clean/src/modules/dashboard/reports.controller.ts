import { Controller, Get, Param, Request } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Get real-time reports analytics data' })
  async getReportsAnalytics(@Request() req: any) {
    const tenantId = req?.user?.tenantId || req?.tenantId || req?.headers?.['x-tenant-id'] || 'tenant-test-001';
    return this.dashboardService.getReportsAnalytics(tenantId);
  }

  @Get(':type')
  @ApiOperation({ summary: 'Export reports analytics data by type' })
  async getReportsExportData(@Param('type') type: string, @Request() req: any) {
    const tenantId = req?.user?.tenantId || req?.tenantId || req?.headers?.['x-tenant-id'] || 'tenant-test-001';
    return this.dashboardService.getReportsExportData(type, tenantId);
  }
}
