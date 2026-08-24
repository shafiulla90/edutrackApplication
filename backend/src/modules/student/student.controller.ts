import { Controller, Get, Post, Patch, Put, Delete, Body, Param, Query, Request } from '@nestjs/common';
import { StudentService } from './student.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { getTenantIdFromReq } from '../../common/utils/tenant.util';

@ApiTags('Students')
@Controller('students')
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Get()
  @ApiOperation({ summary: 'Get all students' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Request() req?: any,
  ) {
    const tenantId = getTenantIdFromReq(req);
    return this.studentService.findAll(
      tenantId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 100,
      { search, classId, sectionId, academicYearId },
    );
  }

  @Get('promotion-candidates')
  @ApiOperation({ summary: 'Get student promotion candidates' })
  getPromotionCandidates(
    @Query('sourceYearId') sourceYearId?: string,
    @Query('className') className?: string,
    @Query('sectionName') sectionName?: string,
    @Request() req?: any,
  ) {
    const tenantId = getTenantIdFromReq(req);
    return this.studentService.getPromotionCandidates(tenantId, sourceYearId, className, sectionName);
  }

  @Post('promote/validate')
  @ApiOperation({ summary: 'Validate student promotions' })
  validatePromotions(@Body() body: any, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    const { studentIds, sourceYearId, targetYearId, targetClassName, targetSectionName } = body || {};
    return this.studentService.validatePromotions(
      tenantId,
      studentIds || [],
      sourceYearId,
      targetYearId,
      targetClassName,
      targetSectionName,
    );
  }

  @Post('promote')
  @ApiOperation({ summary: 'Execute student promotions' })
  executePromotions(@Body() body: any, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    const { studentIds, sourceYearId, targetYearId, targetClassName, targetSectionName } = body || {};
    return this.studentService.executePromotions(
      tenantId,
      studentIds || [],
      sourceYearId,
      targetYearId,
      targetClassName,
      targetSectionName,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get student by ID' })
  findOne(@Param('id') id: string, @Query('academicYearId') academicYearId: string, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.studentService.findOne(id, tenantId, academicYearId);
  }

  @Post()
  @ApiOperation({ summary: 'Create new student profile' })
  create(@Body() body: any, @Request() req) {
    const tenantId = getTenantIdFromReq(req);
    return this.studentService.create(body, tenantId);
  }

  @Post('import')
  @ApiOperation({ summary: 'Bulk import student records' })
  importStudents(@Body() body: any, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    const studentsData = Array.isArray(body) ? body : (body?.students || body?.studentDataList || []);
    return this.studentService.importStudentsBulk(studentsData, tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update student profile' })
  updatePatch(@Param('id') id: string, @Body() body: any, @Request() req) {
    const tenantId = getTenantIdFromReq(req);
    return this.studentService.update(id, body, tenantId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update student profile' })
  updatePut(@Param('id') id: string, @Body() body: any, @Request() req) {
    const tenantId = getTenantIdFromReq(req);
    return this.studentService.update(id, body, tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete student profile' })
  remove(@Param('id') id: string, @Request() req) {
    const tenantId = getTenantIdFromReq(req);
    return this.studentService.delete(id, tenantId);
  }
}
