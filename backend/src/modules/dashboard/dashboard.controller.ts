import { Controller, Get, Request } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get live dashboard summary & statistics' })
  async getDashboardSummary(@Request() req: any) {
    const tenantId = req?.user?.tenantId || req?.tenantId || req?.headers?.['x-tenant-id'] || 'tenant-test-001';
    return this.dashboardService.getDashboardSummary(tenantId);
  }
}
