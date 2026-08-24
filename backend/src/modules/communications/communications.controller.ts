import { Controller, Get, Post, Body, Param, Delete, Request } from '@nestjs/common';
import { CommunicationsService } from './communications.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { getTenantIdFromReq } from '../../common/utils/tenant.util';

@ApiTags('Communications')
@Controller('communications')
export class CommunicationsController {
  constructor(private readonly communicationsService: CommunicationsService) {}

  @Post()
  @ApiOperation({ summary: 'Send a new notification' })
  async send(@Body() data: any, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.communicationsService.sendNotification(data, tenantId);
  }

  @Get('user-notifications')
  @ApiOperation({ summary: 'Get notifications for current active user' })
  async getUserNotifications(@Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    const headerRole = req?.headers?.['x-user-role'] || req?.headers?.['role'];
    let role = headerRole || req?.user?.role || 'TEACHER';
    let userId = req?.headers?.['x-user-id'] || req?.user?.id || req?.user?.phone || req?.user?.email;
    
    if (headerRole && String(headerRole).toUpperCase().includes('TEACHER')) {
      role = 'TEACHER';
      if (!userId || !userId.startsWith('user-t-')) userId = 'user-t-1786969568509';
    } else if (!userId) {
      const roleUpper = String(role).toUpperCase();
      if (roleUpper.includes('TEACHER')) userId = 'user-t-1786969568509';
      else if (roleUpper.includes('PARENT')) userId = 'user-parent';
      else userId = 'user-admin';
    }

    return this.communicationsService.getNotifications(userId, tenantId, role);
  }

  @Get('user/:recipientId')
  @ApiOperation({ summary: 'Get notifications for user' })
  async getForUser(@Param('recipientId') recipientId: string, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    const headerRole = req?.headers?.['x-user-role'] || req?.headers?.['role'];
    let role = headerRole;
    if (!role) {
      if (recipientId.includes('teacher') || recipientId.startsWith('user-t-')) role = 'TEACHER';
      else if (recipientId.includes('parent') || recipientId === 'user-parent') role = 'PARENT';
      else if (recipientId.includes('admin') || recipientId === 'user-admin') role = 'SCHOOL_ADMIN';
      else role = req?.user?.role || 'TEACHER';
    }
    return this.communicationsService.getNotifications(recipientId, tenantId, role);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async read(@Param('id') id: string, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.communicationsService.markAsRead(id, tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  async deleteNotification(@Param('id') id: string, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    const userId = req?.user?.id || req?.user?.phone || req?.user?.email || 'user-parent';
    const role = req?.user?.role || req?.headers?.['x-user-role'] || req?.headers?.['role'] || 'PARENT';
    return this.communicationsService.deleteNotification(id, tenantId, userId, role);
  }

  @Post('clear-read/:recipientId')
  @ApiOperation({ summary: 'Clear read notifications' })
  async clearReadNotifications(@Param('recipientId') recipientId: string, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.communicationsService.clearReadNotifications(recipientId, tenantId);
  }
}
