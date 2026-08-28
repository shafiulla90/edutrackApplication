import { Controller, Get, Post, Body, Param, Query, Patch, Delete, Request } from '@nestjs/common';
import { ComplaintBoxService } from './complaint-box.service';
import { ApiTags } from '@nestjs/swagger';
import { getTenantIdFromReq } from '../../common/utils/tenant.util';

@ApiTags('Complaint Box')
@Controller('complaint-box')
export class ComplaintBoxController {
  constructor(private readonly complaintBoxService: ComplaintBoxService) {}

  @Get('current-teacher')
  getCurrentTeacher(@Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.complaintBoxService.getCurrentTeacher(tenantId);
  }

  @Get('student-classes')
  getStudentClasses(@Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.complaintBoxService.getStudentClasses(tenantId);
  }

  @Get('teachers')
  getTeachers(@Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.complaintBoxService.getTeachers(tenantId);
  }

  @Get('students-by-class/:classSectionId')
  getStudentsByClass(@Param('classSectionId') classSectionId: string, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.complaintBoxService.getStudentsByClass(classSectionId, tenantId);
  }

  @Get('search-students')
  searchStudents(
    @Query('searchTerm') searchTerm?: string,
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
    @Request() req?: any,
  ) {
    const tenantId = getTenantIdFromReq(req);
    return this.complaintBoxService.searchStudents(searchTerm, classId, sectionId, tenantId);
  }

  @Post('submit-behavior')
  submitStudentBehavior(@Body() dto: any, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.complaintBoxService.submitStudentBehavior(dto, tenantId);
  }

  @Get('academic-years')
  getAcademicYears(@Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.complaintBoxService.getAcademicYears(tenantId);
  }

  @Get('pending-cases')
  getPendingCases(@Query('academicYear') academicYear?: string, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.complaintBoxService.getPendingCases(academicYear, tenantId);
  }

  @Get('student-cases/:studentId')
  getStudentCases(@Param('studentId') studentId: string, @Query('academicYear') academicYear?: string, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.complaintBoxService.getStudentCases(studentId, academicYear, tenantId);
  }

  @Patch('case-status/:caseId')
  updateCaseStatus(@Param('caseId') caseId: string, @Body() dto: any, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.complaintBoxService.updateCaseStatus(caseId, dto, tenantId);
  }

  @Get('student-stats/:studentId')
  getStudentStats(@Param('studentId') studentId: string, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.complaintBoxService.getStudentStats(studentId, tenantId);
  }

  @Patch('behavior/:caseId')
  updateBehavior(@Param('caseId') caseId: string, @Body() dto: any, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.complaintBoxService.updateBehavior(caseId, dto, tenantId);
  }

  @Delete('behavior/:caseId')
  deleteBehavior(@Param('caseId') caseId: string, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.complaintBoxService.deleteBehavior(caseId, tenantId);
  }

  @Get('parent-complaints')
  getParentComplaints(@Query('status') status?: string, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.complaintBoxService.getParentComplaints(status, tenantId);
  }

  @Patch('parent-complaints/:id/status')
  updateParentComplaintStatus(@Param('id') id: string, @Body() data: any, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.complaintBoxService.updateParentComplaintStatus(id, data, tenantId);
  }
}
