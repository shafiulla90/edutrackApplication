import { Controller, Get, Post, Body, Param, Query, Request, Res } from '@nestjs/common';
import { ParentPortalService } from './parent-portal.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { getTenantIdFromReq } from '../../common/utils/tenant.util';

@ApiTags('Parent Portal')
@Controller('parent-portal')
export class ParentPortalController {
  constructor(private readonly portalService: ParentPortalService) {}

  @Get('dashboard')
  async getDashboard(@Request() req: any, @Query('parentId') queryParentId?: string, @Query('studentId') queryStudentId?: string) {
    const userId = queryParentId || req?.user?.phone || req?.user?.email || req?.user?.id || 'user-parent';
    const tenantId = getTenantIdFromReq(req);
    return this.portalService.getDashboardStats(userId, tenantId, req?.user, queryStudentId);
  }

  @Get('children')
  async getChildren(@Request() req: any, @Query('parentId') queryParentId?: string) {
    const parentIdentity = queryParentId || req?.user?.phone || req?.user?.email || req?.user?.id || 'user-parent';
    const tenantId = getTenantIdFromReq(req);
    return this.portalService.getChildren(parentIdentity, tenantId, req?.user);
  }

  @Get('children/:studentId/dashboard')
  async getChildDashboard(@Request() req: any, @Param('studentId') studentId: string) {
    const userId = req?.user?.id || 'user-parent';
    return this.portalService.getChildDashboard(userId, studentId);
  }

  @Get('children/:studentId/profile')
  async getStudentProfile(@Request() req: any, @Param('studentId') studentId: string) {
    const userId = req?.user?.id || 'user-parent';
    const tenantId = getTenantIdFromReq(req);
    return this.portalService.getStudentProfile(userId, studentId, tenantId);
  }

  @Get('children/:studentId/attendance')
  async getAttendance(@Request() req: any, @Param('studentId') studentId: string) {
    const userId = req?.user?.id || 'user-parent';
    return this.portalService.getAttendance(userId, studentId);
  }

  @Get('children/:studentId/homework')
  async getHomework(@Request() req: any, @Param('studentId') studentId: string) {
    const userId = req?.user?.id || 'user-parent';
    return this.portalService.getHomework(userId, studentId);
  }

  @Post('children/:studentId/homework/:homeworkId/submit')
  async submitAssignment(
    @Request() req: any,
    @Param('studentId') studentId: string,
    @Param('homeworkId') homeworkId: string,
    @Body() data: any,
  ) {
    const userId = req?.user?.id || 'user-parent';
    const tenantId = getTenantIdFromReq(req);
    return this.portalService.submitAssignment(userId, studentId, homeworkId, data.base64File, data.fileName, tenantId);
  }

  @Get('children/:studentId/exams')
  async getExams(@Request() req: any, @Param('studentId') studentId: string) {
    const userId = req?.user?.id || 'user-parent';
    const tenantId = getTenantIdFromReq(req);
    return this.portalService.getExams(userId, studentId, tenantId);
  }

  @Get('children/:studentId/fees')
  async getFees(@Request() req: any, @Param('studentId') studentId: string) {
    const userId = req?.user?.id || 'user-parent';
    return this.portalService.getFees(userId, studentId);
  }

  @Post('children/:studentId/invoices/:invoiceId/pay')
  async payInvoice(
    @Request() req: any,
    @Param('studentId') studentId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() data: any,
  ) {
    const userId = req?.user?.id || 'user-parent';
    return this.portalService.payInvoice(userId, studentId, invoiceId, data);
  }

  @Get('children/:studentId/invoices/:invoiceId/pdf/download')
  async downloadInvoicePdf(
    @Request() req: any,
    @Res() res: any,
    @Param('studentId') studentId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    const userId = req?.user?.id || 'user-parent';
    return this.portalService.generateInvoicePdf(userId, studentId, invoiceId, res);
  }

  @Get('children/:studentId/timetable')
  async getTimetable(@Request() req: any, @Param('studentId') studentId: string) {
    const userId = req?.user?.id || 'user-parent';
    const tenantId = getTenantIdFromReq(req);
    return this.portalService.getTimetable(userId, studentId, tenantId);
  }

  @Get('children/:studentId/announcements')
  async getAnnouncements(@Request() req: any, @Param('studentId') studentId: string) {
    const userId = req?.user?.id || 'user-parent';
    return this.portalService.getAnnouncements(userId, studentId);
  }

  @Get('children/:studentId/teacher-complaints')
  async getTeacherComplaints(@Request() req: any, @Param('studentId') studentId: string) {
    const userId = req?.user?.id || 'user-parent';
    const tenantId = getTenantIdFromReq(req);
    return this.portalService.getTeacherComplaints(userId, studentId, tenantId);
  }

  @Get('complaints')
  async getComplaints(@Request() req: any) {
    const userId = req?.user?.id || 'user-parent';
    const tenantId = getTenantIdFromReq(req);
    return this.portalService.getComplaints(userId, tenantId);
  }

  @Post('complaints')
  async submitComplaint(@Request() req: any, @Body() data: any) {
    const userId = req?.user?.id || 'user-parent';
    const tenantId = getTenantIdFromReq(req);
    return this.portalService.submitComplaint(userId, tenantId, data);
  }

  @Get('children/:studentId/transport')
  async getTransport(@Request() req: any, @Param('studentId') studentId: string) {
    const userId = req?.user?.id || 'user-parent';
    return this.portalService.getTransport(userId, studentId);
  }

  @Get('children/:studentId/leave')
  async getLeavesHistory(@Request() req: any, @Param('studentId') studentId: string) {
    const userId = req?.user?.id || 'user-parent';
    const tenantId = getTenantIdFromReq(req);
    return this.portalService.getLeavesHistory(userId, studentId, tenantId);
  }

  @Post('children/:studentId/leave')
  async submitLeaveRequest(
    @Request() req: any,
    @Param('studentId') studentId: string,
    @Body() data: any,
  ) {
    const userId = req?.user?.id || 'user-parent';
    const tenantId = getTenantIdFromReq(req);
    return this.portalService.submitLeaveRequest(userId, studentId, data, tenantId);
  }
}
