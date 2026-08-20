import { Controller, Get, Post, Body, Query, Request } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

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
    @Query('subjectType') subjectType?: string,
    @Request() req?: any,
  ) {
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.examsService.getMarksEntryRoster(tenantId, subjectId, examName, classSectionId, subjectType);
  }

  @Post('marks/save')
  @ApiOperation({ summary: 'Save marks roster' })
  async saveMarks(@Body() body: any, @Request() req?: any) {
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.examsService.saveRosterMarks(tenantId, body);
  }
}

@ApiTags('Exam Config')
@Controller('exam-config')
export class ExamConfigController {
  constructor(private readonly examsService: ExamsService) {}

  @Get('components')
  @ApiOperation({ summary: 'Get exam components' })
  async getComponents(@Request() req?: any) {
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.examsService.getComponents(tenantId);
  }
}
