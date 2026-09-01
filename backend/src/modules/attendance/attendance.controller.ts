import { Controller, Get, Post, Param, Body, Request } from '@nestjs/common';
import { AttendanceService } from './attendance.service';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post()
  create(@Body() dto: any, @Request() req) {
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.attendanceService.create(tenantId, {
      studentId: dto.studentId,
      date: dto.date,
      status: dto.status,
    });
  }

  @Get()
  findAll(@Request() req) {
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.attendanceService.findAll(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.attendanceService.findOne(id, tenantId);
  }

  @Get('student/:studentId')
  findByStudent(@Param('studentId') studentId: string, @Request() req) {
    const tenantId = req?.user?.tenantId || 'tenant-test-001';
    return this.attendanceService.findByStudent(studentId, tenantId);
  }
}
