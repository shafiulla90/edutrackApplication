import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Request } from '@nestjs/common';
import { LeaveManagementService } from './leave-management.service';
import { getTenantIdFromReq } from '../../common/utils/tenant.util';

@Controller('leave-management')
export class LeaveManagementController {
  constructor(private readonly leaveManagementService: LeaveManagementService) {}

  @Get()
  getLeaveApplications(@Query() query: any, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.leaveManagementService.getLeaveApplications(tenantId, query);
  }

  @Get('stats')
  getLeaveStats(@Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.leaveManagementService.getLeaveStats(tenantId);
  }

  @Post('apply-staff-leave')
  applyStaffLeave(@Body() body: any, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.leaveManagementService.createLeave(tenantId, body, req?.user);
  }

  @Post()
  createLeave(@Body() body: any, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.leaveManagementService.createLeave(tenantId, body, req?.user);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: any, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    const approverName = req?.user?.name || req?.user?.email || 'Administrator';
    return this.leaveManagementService.updateStatus(tenantId, id, body.status, body.comments || body.remarks, approverName);
  }

  @Post('bulk-status')
  bulkUpdateStatus(@Body() body: any, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    const approverName = req?.user?.name || req?.user?.email || 'Administrator';
    return this.leaveManagementService.bulkUpdateStatus(tenantId, body.ids || [], body.status, body.comments || body.remarks, approverName);
  }

  @Get('history/:applicantType/:applicantId')
  getApplicantHistory(
    @Param('applicantType') applicantType: string,
    @Param('applicantId') applicantId: string,
    @Request() req?: any,
  ) {
    const tenantId = getTenantIdFromReq(req);
    return this.leaveManagementService.getHistory(tenantId, applicantType, applicantId);
  }

  @Delete(':id')
  deleteLeave(@Param('id') id: string, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.leaveManagementService.deleteLeave(tenantId, id);
  }
}
