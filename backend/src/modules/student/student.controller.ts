import { Controller, Get, Post, Patch, Put, Delete, Body, Param, Query, Request } from '@nestjs/common';
import { StudentService } from './student.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

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
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.studentService.findAll(
      tenantId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 100,
      { search, classId, sectionId, academicYearId },
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get student by ID' })
  findOne(@Param('id') id: string, @Request() req) {
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.studentService.findOne(id, tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Create new student profile' })
  create(@Body() body: any, @Request() req) {
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.studentService.create(body, tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update student profile' })
  updatePatch(@Param('id') id: string, @Body() body: any, @Request() req) {
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.studentService.update(id, body, tenantId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update student profile' })
  updatePut(@Param('id') id: string, @Body() body: any, @Request() req) {
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.studentService.update(id, body, tenantId);
  }

  @Post('bulk-delete')
  @ApiOperation({ summary: 'Bulk delete student profiles' })
  bulkDelete(@Body('studentIds') studentIds: string[], @Request() req: any) {
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.studentService.bulkDelete(studentIds || [], tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete student profile' })
  remove(@Param('id') id: string, @Request() req) {
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.studentService.delete(id, tenantId);
  }
}

