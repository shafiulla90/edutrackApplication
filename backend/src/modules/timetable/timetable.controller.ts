import { Controller, Get, Post, Patch, Delete, Param, Body, Request, Query } from '@nestjs/common';
import { TimetableService } from './timetable.service';
import { getTenantIdFromReq } from '../../common/utils/tenant.util';
import {
  CreateClassDto,
  CreateSectionDto,
  CreateSubjectDto,
  BulkSubjectsInputDto,
  CreateTeacherWithSkillsDto,
  BulkTeachersInputDto,
  CreateClassSectionDto,
  UpdateTeacherAssignmentDto,
  SaveSubstituteDto,
  SaveTimetablePeriodsDto,
  PeriodTimingDto,
} from './dto/timetable.dto';

@Controller('timetable')
export class TimetableController {
  constructor(private readonly timetableService: TimetableService) {}

  private getTenantId(req: any): string {
    return getTenantIdFromReq(req);
  }

  @Get('academic-years')
  getAcademicYears(@Request() req) {
    return this.timetableService.getAcademicYears(this.getTenantId(req));
  }

  @Get('classes')
  getClasses(@Request() req) {
    return this.timetableService.getClasses(this.getTenantId(req));
  }

  @Post('classes')
  createClass(@Body() dto: CreateClassDto, @Request() req) {
    return this.timetableService.createClass(this.getTenantId(req), dto.name);
  }

  @Delete('classes/:id')
  deleteClass(@Param('id') id: string, @Request() req) {
    return this.timetableService.deleteClass(this.getTenantId(req), id);
  }

  @Get('sections')
  getSections(@Request() req) {
    return this.timetableService.getSections(this.getTenantId(req));
  }

  @Post('sections')
  createSection(@Body() dto: CreateSectionDto, @Request() req) {
    return this.timetableService.createSection(this.getTenantId(req), dto.name);
  }

  @Delete('sections/:id')
  deleteSection(@Param('id') id: string, @Request() req) {
    return this.timetableService.deleteSection(this.getTenantId(req), id);
  }

  @Get('period-timings')
  getPeriodTimings(@Request() req) {
    return this.timetableService.getPeriodTimings(this.getTenantId(req));
  }

  @Post('period-timings')
  savePeriodTimings(@Body() dto: PeriodTimingDto[], @Request() req) {
    return this.timetableService.savePeriodTimings(this.getTenantId(req), dto);
  }

  @Get('config')
  getTimetableConfig(@Request() req) {
    return this.timetableService.getTimetableConfig(this.getTenantId(req));
  }

  @Get('config/check-existing')
  checkExistingTimetables(@Request() req) {
    return this.timetableService.checkExistingTimetables(this.getTenantId(req));
  }

  @Post('config')
  saveTimetableConfig(@Body() dto: any, @Request() req) {
    return this.timetableService.saveTimetableConfig(this.getTenantId(req), dto);
  }

  @Get('subjects')
  getSubjects(@Request() req) {
    return this.timetableService.getSubjects(this.getTenantId(req));
  }

  @Post('subjects')
  createSubject(@Body() dto: CreateSubjectDto, @Request() req) {
    return this.timetableService.createSubject(this.getTenantId(req), dto);
  }

  @Delete('subjects/:id')
  deleteSubject(@Param('id') id: string, @Request() req) {
    return this.timetableService.deleteSubject(this.getTenantId(req), id);
  }

  @Post('subjects/bulk')
  bulkCreateSubjects(@Body() dto: BulkSubjectsInputDto, @Request() req) {
    return this.timetableService.bulkCreateSubjects(this.getTenantId(req), dto.subjects);
  }

  @Get('teachers/subject')
  getTeachersForSubject(@Query('subjectIds') subjectIds: string, @Request() req) {
    const ids = subjectIds ? subjectIds.split(',') : [];
    return this.timetableService.getTeachersForSubject(this.getTenantId(req), ids);
  }

  @Post('teachers')
  createTeacher(@Body() dto: CreateTeacherWithSkillsDto, @Request() req) {
    return this.timetableService.createTeacherWithSkills(this.getTenantId(req), dto);
  }

  @Post('teachers/bulk')
  bulkCreateTeachers(@Body() dto: BulkTeachersInputDto, @Request() req) {
    return this.timetableService.bulkCreateTeachers(this.getTenantId(req), dto.teachers);
  }

  @Get('teachers/subject-in-class')
  getTeachersForSubjectInClass(
    @Query('subjectId') subjectId: string,
    @Query('classSectionId') classSectionId: string,
    @Request() req
  ) {
    return this.timetableService.getTeachersForSubjectInClass(
      this.getTenantId(req),
      subjectId,
      classSectionId
    );
  }

  @Get('workload/summary')
  getWorkloadSummary(@Query('academicYearId') academicYearId: string, @Request() req) {
    return this.timetableService.getWorkloadSummary(this.getTenantId(req), academicYearId);
  }

  @Get('workload/teachers')
  getAllTeacherWorkloads(@Request() req) {
    return this.timetableService.getAllTeacherWorkloads(this.getTenantId(req));
  }

  @Get('workload/classes')
  getAllClassWorkloads(@Request() req) {
    return this.timetableService.getAllClassWorkloads(this.getTenantId(req));
  }

  @Get('workload/teacher/:id')
  getTeacherWorkload(@Param('id') id: string, @Request() req) {
    return this.timetableService.getTeacherWorkload(this.getTenantId(req), id);
  }

  @Get('workload/class-section/:id')
  getClassSectionWorkload(@Param('id') id: string, @Request() req) {
    return this.timetableService.getClassSectionWorkload(this.getTenantId(req), id);
  }

  @Patch('assignments/:id')
  updateTeacherAssignment(
    @Param('id') id: string,
    @Body() dto: UpdateTeacherAssignmentDto,
    @Request() req
  ) {
    return this.timetableService.updateTeacherAssignment(
      this.getTenantId(req),
      id,
      dto.newTeacherId,
      dto.periodsPerWeek
    );
  }

  @Delete('assignments/:id')
  deleteTeacherAssignment(@Param('id') id: string, @Request() req) {
    return this.timetableService.deleteTeacherAssignment(this.getTenantId(req), id);
  }

  @Post('class-sections')
  createClassSection(@Body() dto: CreateClassSectionDto, @Request() req) {
    return this.timetableService.createClassSection(this.getTenantId(req), dto);
  }

  @Get('class-sections')
  getAllClassSections(@Request() req) {
    return this.timetableService.getAllClassSections(this.getTenantId(req));
  }

  @Get('teachers')
  getAllTeachers(@Request() req) {
    return this.timetableService.getAllTeachers(this.getTenantId(req));
  }

  @Get('teachers/:id/skills')
  getTeacherSkills(@Param('id') id: string, @Request() req) {
    return this.timetableService.getTeacherSkills(this.getTenantId(req), id);
  }

  @Get('class/:classSectionId/periods')
  getPeriodsForClassSection(
    @Param('classSectionId') classSectionId: string,
    @Query('academicYearId') academicYearId: string,
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.timetableService.getTimetableForClass(
      this.getTenantId(req),
      classSectionId,
      academicYearId,
      startDate,
      endDate
    );
  }

  @Get('teacher/:teacherId/periods')
  getPeriodsForTeacher(
    @Param('teacherId') teacherId: string,
    @Query('gaps') gaps: string,
    @Request() req
  ) {
    if (gaps === 'true') {
      return this.timetableService.getPeriodsForTeacherWithGaps(this.getTenantId(req), teacherId);
    }
    return this.timetableService.getPeriodsForTeacher(this.getTenantId(req), teacherId);
  }

  @Get('teacher/:teacherId/leaser-periods')
  getLeaserPeriodsForTeacher(@Param('teacherId') teacherId: string, @Request() req) {
    return this.timetableService.getLeaserPeriodsForTeacher(this.getTenantId(req), teacherId);
  }

  @Post('periods/substitute')
  saveSubstituteForPeriod(@Body() dto: SaveSubstituteDto, @Request() req) {
    return this.timetableService.saveSubstituteForPeriod(
      this.getTenantId(req),
      dto.periodId,
      dto.substituteTeacherId
    );
  }

  @Post('periods/save')
  saveTimetablePeriods(@Body() dto: SaveTimetablePeriodsDto, @Request() req) {
    return this.timetableService.saveTimetablePeriods(this.getTenantId(req), dto);
  }
}
