import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Request } from '@nestjs/common';
import { TeacherService } from './teacher.service';
import { getTenantIdFromReq } from '../../common/utils/tenant.util';

@Controller('teachers')
export class TeacherController {
  constructor(private readonly teacherService: TeacherService) {}

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('department') department?: string,
    @Request() req?: any,
  ) {
    const tenantId = getTenantIdFromReq(req);
    return this.teacherService.findAll(tenantId, { search, role, department });
  }

  @Post('pay-all-salaries')
  payAllSalaries(@Body() body: any, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.teacherService.payAllSalaries(tenantId, body);
  }

  @Post('pay-salary')
  paySalaryGeneric(@Body() body: any, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    const id = body?.id || body?.staffId || 'staff-001';
    return this.teacherService.paySalary(id, tenantId, body);
  }

  @Post(':id/pay-salary')
  paySalary(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.teacherService.paySalary(id, tenantId, body);
  }

  @Patch(':id/pay-salary')
  paySalaryPatch(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.teacherService.paySalary(id, tenantId, body);
  }

  @Get(':id/salary-invoices')
  getSalaryInvoices(@Param('id') id: string, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.teacherService.getSalaryInvoices(id, tenantId);
  }

  @Get(':id/cases')
  getCases(@Param('id') id: string, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.teacherService.getCases(id, tenantId);
  }

  @Get(':id/schedule')
  getSchedule(@Param('id') id: string, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.teacherService.getSchedule(id, tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.teacherService.findOne(id, tenantId);
  }

  @Post()
  create(@Body() createDto: any, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.teacherService.create(tenantId, createDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: any, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.teacherService.update(id, tenantId, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.teacherService.remove(id, tenantId);
  }
}
