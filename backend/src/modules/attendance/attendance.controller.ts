import { Controller, Get, Post, Param, Body, Query, Request } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { getTenantIdFromReq } from '../../common/utils/tenant.util';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('teachers')
  getTeachers(@Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.attendanceService.getTeachers(tenantId);
  }

  @Get('classes')
  getClasses(@Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.attendanceService.getClasses(tenantId);
  }

  @Get('sections')
  getSections(@Query('classVal') classVal?: string, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.attendanceService.getSections(tenantId, classVal);
  }

  @Get('students')
  getStudentsForAttendance(
    @Query('classVal') classVal?: string,
    @Query('sectionVal') sectionVal?: string,
    @Request() req?: any,
  ) {
    const tenantId = getTenantIdFromReq(req);
    return this.attendanceService.getStudentsForAttendance(tenantId, classVal, sectionVal);
  }

  @Get('session-data')
  getSessionData(
    @Query('classVal') classVal: string,
    @Query('sectionVal') sectionVal: string,
    @Query('dateVal') dateVal: string,
    @Request() req?: any,
  ) {
    const tenantId = getTenantIdFromReq(req);
    return this.attendanceService.getSessionData(tenantId, classVal, sectionVal, dateVal);
  }

  @Get('recent')
  getRecentSubmissions(@Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.attendanceService.getRecentSubmissions(tenantId);
  }

  @Get('report-data')
  getReportData(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Request() req?: any,
  ) {
    const tenantId = getTenantIdFromReq(req);
    return this.attendanceService.getReportData(tenantId, startDate, endDate);
  }

  @Get('session')
  getSession(
    @Query('classSectionId') classSectionId: string,
    @Query('date') date: string,
    @Request() req?: any,
  ) {
    const tenantId = getTenantIdFromReq(req);
    return this.attendanceService.getSession(tenantId, classSectionId, date);
  }

  @Post('save')
  saveAttendance(@Body() body: any, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.attendanceService.saveAttendance(tenantId, {
      classSectionId: body.classVal || body.classSectionId,
      date: body.dateStr || body.date,
      teacherId: body.teacherId,
      presentCount: body.presentCount,
      absentCount: body.absentCount,
      totalStudents: body.totalStudents,
      absentStudentIds: body.absentStudentIds || [],
    });
  }

  @Get('class-report')
  getClassReport(
    @Query('classSectionId') classSectionId?: string,
    @Query('date') date?: string,
    @Request() req?: any,
  ) {
    const tenantId = getTenantIdFromReq(req);
    return this.attendanceService.getClassReport(tenantId, classSectionId, date);
  }

  @Get('history')
  getHistory(
    @Query('classSectionId') classSectionId?: string,
    @Request() req?: any,
  ) {
    const tenantId = getTenantIdFromReq(req);
    return this.attendanceService.getHistory(tenantId, classSectionId);
  }

  @Post()
  create(@Body() dto: any, @Request() req) {
    const tenantId = getTenantIdFromReq(req);
    return this.attendanceService.create(tenantId, {
      studentId: dto.studentId,
      date: dto.date,
      status: dto.status,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    const tenantId = getTenantIdFromReq(req);
    return this.attendanceService.findOne(id, tenantId);
  }

  @Get('student/:studentId')
  findByStudent(@Param('studentId') studentId: string, @Request() req) {
    const tenantId = getTenantIdFromReq(req);
    return this.attendanceService.findByStudent(studentId, tenantId);
  }
}
