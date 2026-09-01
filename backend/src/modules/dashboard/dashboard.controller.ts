import { Controller, Get, Request } from '@nestjs/common';
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
}
