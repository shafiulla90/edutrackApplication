import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, Request } from '@nestjs/common';
import { TeacherPortalService } from './teacher-portal.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Teacher Portal')
@Controller('teacher-portal')
export class TeacherPortalController {
  constructor(private readonly portalService: TeacherPortalService) {}

  @Get('dashboard')
  async getDashboard(@Request() req: any) {
    const userId = req?.user?.id || 'user-active';
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.portalService.getDashboardStats(userId, tenantId);
  }

  @Get('profile')
  async getProfile(@Request() req: any) {
    const userId = req?.user?.id || 'user-active';
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.portalService.getProfile(userId, tenantId);
  }

  @Put('profile')
  async updateProfile(@Request() req: any, @Body() data: any) {
    const userId = req?.user?.id || 'user-active';
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.portalService.updateProfile(userId, tenantId, data);
  }

  @Post('profile/change-password')
  async changePassword(@Request() req: any, @Body() data: any) {
    const userId = req?.user?.id || 'user-active';
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.portalService.changePassword(userId, tenantId, data);
  }

  @Get('classes')
  async getClasses(@Request() req: any) {
    const userId = req?.user?.id || 'user-active';
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.portalService.getAssignedClasses(userId, tenantId);
  }

  @Get('classes/:classSectionId/students')
  async getStudents(@Request() req: any, @Param('classSectionId') classSectionId: string) {
    const userId = req?.user?.id || 'user-active';
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.portalService.getStudentsForClassSection(userId, tenantId, classSectionId);
  }

  @Get('attendance/classes')
  async getAttendanceClasses(@Request() req: any) {
    const userId = req?.user?.id || 'user-active';
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.portalService.getClassesForAttendance(userId, tenantId);
  }

  @Get('attendance/sections')
  async getAttendanceSections(@Request() req: any, @Query('classVal') classVal: string) {
    const userId = req?.user?.id || 'user-active';
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.portalService.getSectionsForAttendance(userId, tenantId, classVal);
  }

  @Get('attendance/students')
  async getAttendanceStudents(
    @Request() req: any,
    @Query('classVal') classVal: string,
    @Query('sectionVal') sectionVal: string,
  ) {
    const userId = req?.user?.id || 'user-active';
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.portalService.getStudentsForAttendance(userId, tenantId, classVal, sectionVal);
  }

  @Post('attendance/save')
  async saveAttendance(@Request() req: any, @Body() data: any) {
    const userId = req?.user?.id || 'user-active';
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.portalService.saveAttendanceSheet(userId, tenantId, data);
  }

  @Get('attendance/history')
  async getAttendanceHistory(@Request() req: any) {
    const userId = req?.user?.id || 'user-active';
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.portalService.getAttendanceHistory(userId, tenantId);
  }

  @Get('marks/entry')
  async getMarksEntryList(
    @Request() req: any,
    @Query('subjectId') subjectId: string,
    @Query('examName') examName: string,
    @Query('classSectionId') classSectionId: string,
    @Query('subjectType') subjectType?: string,
  ) {
    const userId = req?.user?.id || 'user-active';
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.portalService.getExamMarksEntryList(userId, tenantId, subjectId, examName, classSectionId, subjectType);
  }

  @Post('marks/save')
  async saveMarks(@Request() req: any, @Body() data: any) {
    const userId = req?.user?.id || 'user-active';
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.portalService.saveExamMarksList(userId, tenantId, data);
  }

  @Get('timetable')
  async getTimetable(@Request() req: any) {
    const userId = req?.user?.id || 'user-active';
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.portalService.getTeacherWeeklySchedule(userId, tenantId);
  }

  @Get('homework')
  async getHomeworks(@Request() req: any) {
    const userId = req?.user?.id || 'user-active';
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.portalService.getHomeworks(userId, tenantId);
  }

  @Post('homework')
  async createHomework(@Request() req: any, @Body() data: any) {
    const userId = req?.user?.id || 'user-active';
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.portalService.createHomework(userId, tenantId, data);
  }

  @Put('homework/:id')
  async updateHomework(@Request() req: any, @Param('id') id: string, @Body() data: any) {
    const userId = req?.user?.id || 'user-active';
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.portalService.updateHomework(userId, tenantId, id, data);
  }

  @Delete('homework/:id')
  async deleteHomework(@Request() req: any, @Param('id') id: string) {
    const userId = req?.user?.id || 'user-active';
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.portalService.deleteHomework(userId, tenantId, id);
  }

  @Post('homework/:id/send-to-parents')
  async sendHomeworkToParents(@Request() req: any, @Param('id') id: string) {
    const userId = req?.user?.id || 'user-active';
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.portalService.sendHomeworkToParents(userId, tenantId, id);
  }

  @Get('announcements')
  async getAnnouncements(@Request() req: any) {
    const userId = req?.user?.id || 'user-active';
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.portalService.getAnnouncements(userId, tenantId);
  }

  @Post('announcements')
  async createAnnouncement(@Request() req: any, @Body() data: any) {
    const userId = req?.user?.id || 'user-active';
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.portalService.createAnnouncement(userId, tenantId, data);
  }

  @Delete('announcements/:id')
  async deleteAnnouncement(@Request() req: any, @Param('id') id: string) {
    const userId = req?.user?.id || 'user-active';
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.portalService.deleteAnnouncement(userId, tenantId, id);
  }

  @Post('announcements/:id/read')
  async markAsRead(@Request() req: any, @Param('id') id: string) {
    const userId = req?.user?.id || 'user-active';
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.portalService.markAnnouncementAsRead(userId, tenantId, id);
  }

  @Get('leave')
  async getLeaves(@Request() req: any) {
    const userId = req?.user?.id || 'user-active';
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.portalService.getLeaveRequests(userId, tenantId);
  }

  @Post('leave')
  async applyLeave(@Request() req: any, @Body() data: any) {
    const userId = req?.user?.id || 'user-active';
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.portalService.applyLeave(userId, tenantId, data);
  }

  @Delete('leave/:id')
  async cancelLeave(@Request() req: any, @Param('id') id: string) {
    const userId = req?.user?.id || 'user-active';
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.portalService.cancelLeave(userId, tenantId, id);
  }

  @Patch('leave/:id/status')
  async updateLeaveStatus(@Request() req: any, @Param('id') id: string, @Body() data: any) {
    const userId = req?.user?.id || 'user-active';
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.portalService.updateLeaveStatus(userId, tenantId, id, data);
  }

  @Get('communication/audience')
  async getCommAudience(@Request() req: any) {
    const userId = req?.user?.id || 'user-active';
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.portalService.getCommunicationAudience(userId, tenantId);
  }

  @Post('communication/send')
  async sendBroadcast(@Request() req: any, @Body() data: any) {
    const userId = req?.user?.id || 'user-active';
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.portalService.sendBroadcastMessage(userId, tenantId, data);
  }

  @Get('calendar')
  async getCalendar(
    @Request() req: any,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    const userId = req?.user?.id || 'user-active';
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.portalService.getCalendarTimeline(
      userId,
      tenantId,
      parseInt(month || '8', 10),
      parseInt(year || '2026', 10),
    );
  }

  @Get('student-progress/:studentId')
  async getStudentProgress(@Request() req: any, @Param('studentId') studentId: string) {
    const userId = req?.user?.id || 'user-active';
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.portalService.getStudentProgressDetails(userId, tenantId, studentId);
  }

  @Get('salary/details')
  async getSalaryDetails(@Request() req: any) {
    const userId = req?.user?.id || 'user-active';
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.portalService.getMySalaryDetails(userId, tenantId);
  }

  @Get('salary/history')
  async getSalaryHistory(@Request() req: any) {
    const userId = req?.user?.id || 'user-active';
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.portalService.getMySalaryHistory(userId, tenantId);
  }

  @Get('salary/payslip/:expenseId')
  async getPayslipData(@Request() req: any, @Param('expenseId') expenseId: string) {
    const userId = req?.user?.id || 'user-active';
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.portalService.getPayslipPDFData(userId, tenantId, expenseId);
  }
}
