import { Controller, Get, Post, Delete, Body, Query, Param, Request } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { getTenantIdFromReq } from '../../common/utils/tenant.util';

@ApiTags('Teacher Portal Marks')
@Controller('teacher-portal')
export class TeacherPortalController {
  constructor(private readonly examsService: ExamsService) {}

  @Get('marks/entry')
  @ApiOperation({ summary: 'Get marks entry roster' })
  async getMarksEntry(
    @Query('subjectId') subjectId: string,
    @Query('examName') examName: string,
    @Query('classSectionId') classSectionId: string,
    @Query('className') className?: string,
    @Query('sectionName') sectionName?: string,
    @Query('subjectType') subjectType?: string,
    @Request() req?: any,
  ) {
    const tenantId = getTenantIdFromReq(req);
    return this.examsService.getMarksEntryRoster(tenantId, subjectId, examName, classSectionId, className, sectionName, subjectType);
  }

  @Post('marks/save')
  @ApiOperation({ summary: 'Save marks roster' })
  async saveMarks(@Body() body: any, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.examsService.saveRosterMarks(tenantId, body);
  }
}

@ApiTags('Exam Config')
@Controller('exam-config')
export class ExamConfigController {
  constructor(private readonly examsService: ExamsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all exam configurations' })
  async getConfigs(@Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.examsService.getExamConfigs(tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Create or update exam configuration' })
  async createConfig(@Body() body: any, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.examsService.createExamConfig(tenantId, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete exam configuration' })
  async deleteConfig(@Param('id') id: string, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.examsService.deleteExamConfig(tenantId, id);
  }

  @Get('components')
  @ApiOperation({ summary: 'Get exam components' })
  async getComponents(@Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.examsService.getComponents(tenantId);
  }

  @Post('components')
  @ApiOperation({ summary: 'Create exam component' })
  async createComponent(@Body('name') name: string, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.examsService.createComponent(tenantId, name);
  }

  @Delete('components/:id')
  @ApiOperation({ summary: 'Delete exam component' })
  async deleteComponent(@Param('id') id: string, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.examsService.deleteComponent(tenantId, id);
  }

  @Get('resolve')
  @ApiOperation({ summary: 'Resolve exam configuration' })
  async resolveConfig(@Query('examType') examType: string, @Query('classId') classId?: string, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.examsService.resolveConfig(tenantId, examType, classId);
  }
}
