import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, Request } from '@nestjs/common';
import { TeacherService } from './teacher.service';
import { getTenantIdFromReq } from '../../common/utils/tenant.util';

@Controller('teachers')
export class TeacherController {
  constructor(private readonly teacherService: TeacherService) {}

  @Post('reconcile')
  reconcile(@Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.teacherService.reconcile(tenantId);
  }

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

  @Put(':id')
  updatePut(@Param('id') id: string, @Body() updateDto: any, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.teacherService.update(id, tenantId, updateDto);
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

