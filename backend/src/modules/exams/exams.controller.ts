import { Controller, Get, Post, Put, Delete, Body, Query, Param, Request } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Exams')
@Controller('exams')
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Post()
  @ApiOperation({ summary: 'Create new exam' })
  async create(
    @Body('name') name: string,
    @Body('type') type: string,
    @Body('classSectionId') classSectionId: string,
    @Body('date') date: Date,
    @Request() req: any,
  ) {
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.examsService.createExam(name, type, classSectionId, date, tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all exams' })
  async getAll(@Query('classSectionId') classSectionId?: string, @Request() req?: any) {
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.examsService.getExams(classSectionId, tenantId);
  }

  @Get('exam-types')
  @ApiOperation({ summary: 'Get exam types' })
  async getExamTypes(@Request() req?: any) {
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.examsService.getExamTypes(tenantId);
  }

  @Get('exam-types/manage')
  @ApiOperation({ summary: 'Get exam types for management' })
  async getExamTypesManage(@Request() req?: any) {
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.examsService.getExamTypes(tenantId);
  }

  @Post('exam-types')
  @ApiOperation({ summary: 'Create exam type' })
  async createExamType(@Body('name') name: string, @Request() req?: any) {
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.examsService.createExamType(name, tenantId);
  }

  @Put('exam-types/:id')
  @ApiOperation({ summary: 'Update exam type' })
  async updateExamType(@Param('id') id: string, @Body('name') name: string, @Request() req?: any) {
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.examsService.updateExamType(id, name, tenantId);
  }

  @Delete('exam-types/:id')
  @ApiOperation({ summary: 'Delete exam type' })
  async deleteExamType(@Param('id') id: string, @Request() req?: any) {
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.examsService.deleteExamType(id, tenantId);
  }

  @Post('save-marks')
  @ApiOperation({ summary: 'Save exam marks' })
  async saveMarks(
    @Body('marks') marks: any[],
    @Body('examName') examName: string,
    @Body('classSectionId') classSectionId: string,
    @Body('subjectId') subjectId: string,
    @Request() req?: any,
  ) {
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.examsService.saveMarks(marks || [], examName, classSectionId, subjectId, tenantId);
  }

  @Get('grades-report')
  @ApiOperation({ summary: 'Get grades report' })
  async getReport(@Query('classSectionId') classSectionId: string, @Query('examName') examName: string) {
    return this.examsService.getGradesReport(classSectionId, examName);
  }
}
