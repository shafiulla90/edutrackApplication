import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request } from '@nestjs/common';
import { AcademicsService } from './academics.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { getTenantIdFromReq } from '../../common/utils/tenant.util';

@ApiTags('Academics')
@Controller('academics')
export class AcademicsController {
  constructor(private readonly academicsService: AcademicsService) {}

  @Post('academic-years')
  @ApiOperation({ summary: 'Create new academic year term' })
  async createYear(
    @Body('name') name: string,
    @Body('startDate') startDate: any,
    @Body('endDate') endDate: any,
    @Body('isActive') isActive: boolean,
    @Request() req: any,
  ) {
    const tenantId = getTenantIdFromReq(req);
    return this.academicsService.createAcademicYear(name, startDate, endDate, isActive, tenantId);
  }

  @Get('academic-years')
  @ApiOperation({ summary: 'Get all academic year terms' })
  async getYears(@Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.academicsService.getAcademicYears(tenantId);
  }

  @Patch('academic-years/:id/toggle')
  @ApiOperation({ summary: 'Toggle active status of academic year' })
  async toggleYearActive(@Param('id') id: string, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.academicsService.toggleAcademicYearActive(id, tenantId);
  }

  @Patch('academic-years/:id/active')
  @ApiOperation({ summary: 'Set active status of academic year' })
  async setYearActive(@Param('id') id: string, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.academicsService.toggleAcademicYearActive(id, tenantId);
  }

  @Post('classes')
  @ApiOperation({ summary: 'Create class' })
  async createClass(
    @Body('name') name: string,
    @Body('academicYearId') academicYearId: string,
    @Request() req: any,
  ) {
    const tenantId = getTenantIdFromReq(req);
    return this.academicsService.createClass(name, academicYearId, tenantId);
  }

  @Get('classes')
  @ApiOperation({ summary: 'Get classes' })
  async getClasses(@Query('academicYearId') academicYearId?: string, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.academicsService.getClasses(academicYearId, tenantId);
  }

  @Get('classes/:id/student-count')
  async getClassStudentCount(@Param('id') id: string) {
    return this.academicsService.getClassStudentCount(id);
  }

  @Delete('classes/:id')
  async deleteClass(@Param('id') id: string) {
    return this.academicsService.deleteClass(id);
  }

  @Post('sections')
  async createSection(@Body('name') name: string, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.academicsService.createSection(name, tenantId);
  }

  @Get('sections')
  async getSections(@Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.academicsService.getSections(tenantId);
  }

  @Delete('sections/:id')
  async deleteSection(@Param('id') id: string) {
    return this.academicsService.deleteSection(id);
  }

  @Post('class-sections')
  async createClassSection(
    @Body('classId') classId: string,
    @Body('sectionId') sectionId: string,
    @Body('teacherId') teacherId?: string,
    @Request() req?: any,
  ) {
    const tenantId = getTenantIdFromReq(req);
    return this.academicsService.createClassSection(classId, sectionId, teacherId, tenantId);
  }

  @Get('class-sections')
  async getClassSections(@Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.academicsService.getClassSections(tenantId);
  }

  @Post('subjects')
  async createSubject(@Body('name') name: string, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.academicsService.createSubject(name, tenantId);
  }

  @Get('subjects')
  async getSubjects(@Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.academicsService.getSubjects(tenantId);
  }

  @Delete('subjects/:id')
  async deleteSubject(@Param('id') id: string) {
    return this.academicsService.deleteSubject(id);
  }

  @Post('class-sections/:classSectionId/subjects')
  async addSubjectToClassSection(
    @Param('classSectionId') classSectionId: string,
    @Body('subjectId') subjectId: string,
  ) {
    return this.academicsService.addSubjectToClassSection(classSectionId, subjectId);
  }

  @Get('class-sections/:classSectionId/subjects')
  async getClassSectionSubjects(@Param('classSectionId') classSectionId: string) {
    return this.academicsService.getClassSubjects(classSectionId);
  }

  @Delete('class-sections/:classSectionId/subjects/:subjectId')
  async removeSubjectFromClassSection(
    @Param('classSectionId') classSectionId: string,
    @Param('subjectId') subjectId: string,
  ) {
    return this.academicsService.removeSubjectFromClassSection(classSectionId, subjectId);
  }
}
