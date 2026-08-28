import { Controller, Get, Post, Patch, Delete, Body, Param, Request } from '@nestjs/common';
import { TransportService } from './transport.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { getTenantIdFromReq } from '../../common/utils/tenant.util';

@ApiTags('Transport')
@Controller('transport')
export class TransportController {
  constructor(private readonly transportService: TransportService) {}

  @Get('admin/dashboard')
  @ApiOperation({ summary: 'Get transport dashboard stats & live multi-bus fleet locations' })
  async getDashboard(@Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.transportService.getDashboardData(tenantId);
  }

  // BUSES
  @Get('buses')
  @ApiOperation({ summary: 'Get all buses' })
  async getBuses(@Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.transportService.getBuses(tenantId);
  }

  @Post('buses')
  @ApiOperation({ summary: 'Create new bus' })
  async createBus(@Body() body: any, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.transportService.createBus(body, tenantId);
  }

  @Patch('buses/:id')
  @ApiOperation({ summary: 'Update bus details/status' })
  async updateBus(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.transportService.updateBus(id, body, tenantId);
  }

  @Delete('buses/:id')
  @ApiOperation({ summary: 'Delete bus' })
  async deleteBus(@Param('id') id: string, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.transportService.deleteBus(id, tenantId);
  }

  // DRIVERS
  @Get('drivers')
  @ApiOperation({ summary: 'Get all drivers' })
  async getDrivers(@Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.transportService.getDrivers(tenantId);
  }

  @Post('drivers')
  @ApiOperation({ summary: 'Create new driver profile' })
  async createDriver(@Body() body: any, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.transportService.createDriver(body, tenantId);
  }

  @Patch('drivers/:id')
  @ApiOperation({ summary: 'Update driver profile' })
  async updateDriver(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.transportService.updateDriver(id, body, tenantId);
  }

  @Delete('drivers/:id')
  @ApiOperation({ summary: 'Delete driver profile' })
  async deleteDriver(@Param('id') id: string, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.transportService.deleteDriver(id, tenantId);
  }

  // ROUTES & STOPS
  @Get('routes')
  @ApiOperation({ summary: 'Get all transport routes and stops' })
  async getRoutes(@Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.transportService.getRoutes(tenantId);
  }

  @Post('routes')
  @ApiOperation({ summary: 'Create new transport route' })
  async createRoute(@Body() body: any, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.transportService.createRoute(body, tenantId);
  }

  @Post('routes/:id/stops')
  @ApiOperation({ summary: 'Add bus stop to route' })
  async addStop(@Param('id') routeId: string, @Body() body: any, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.transportService.addStopToRoute(routeId, body, tenantId);
  }

  @Delete('routes/:id/stops/:stopId')
  @ApiOperation({ summary: 'Delete bus stop from route' })
  async deleteStop(@Param('id') routeId: string, @Param('stopId') stopId: string, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.transportService.deleteStopFromRoute(routeId, stopId, tenantId);
  }

  @Delete('routes/:id')
  @ApiOperation({ summary: 'Delete transport route' })
  async deleteRoute(@Param('id') id: string, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.transportService.deleteRoute(id, tenantId);
  }

  // STUDENT ASSIGNMENTS
  @Get('students/assignments')
  @ApiOperation({ summary: 'Get all student bus assignments' })
  async getStudentAssignments(@Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.transportService.getStudentAssignments(tenantId);
  }

  @Post('students/assignments')
  @ApiOperation({ summary: 'Assign student to bus route' })
  async createStudentAssignment(@Body() body: any, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.transportService.createStudentAssignment(body, tenantId);
  }

  @Delete('students/assignments/:id')
  @ApiOperation({ summary: 'Remove student bus assignment' })
  async deleteStudentAssignment(@Param('id') id: string, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.transportService.deleteStudentAssignment(id, tenantId);
  }

  // TRIP HISTORY
  @Get('trip-history')
  @ApiOperation({ summary: 'Get transport trip history' })
  async getTripHistory(@Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.transportService.getTripHistory(tenantId);
  }

  // GPS TELEMETRY & DRIVER / PARENT APP
  @Post('gps-telemetry')
  @ApiOperation({ summary: 'Post real-time GPS telemetry update for bus' })
  async postGpsTelemetry(@Body() body: any, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.transportService.updateGpsTelemetry(body, tenantId);
  }

  @Get('driver/assigned-bus')
  @ApiOperation({ summary: 'Get driver assigned bus and active duty details' })
  async getDriverAssignedBus(@Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.transportService.getDriverAssignedBus(tenantId);
  }

  @Post('driver/trip-action')
  @ApiOperation({ summary: 'Start/stop driver duty trip or send SOS' })
  async driverTripAction(@Body() body: any, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.transportService.handleDriverTripAction(body, tenantId);
  }

  @Get('parent-portal/children/:studentId')
  @ApiOperation({ summary: 'Get parent live bus tracking data for student' })
  async getParentLiveTracking(@Param('studentId') studentId: string, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.transportService.getParentLiveTracking(studentId, tenantId);
  }
}
