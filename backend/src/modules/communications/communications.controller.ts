import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { CommunicationsService } from './communications.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Communications')
@Controller('communications')
export class CommunicationsController {
  constructor(private readonly communicationsService: CommunicationsService) {}

  @Post()
  @ApiOperation({ summary: 'Send a new notification' })
  async send(@Body() data: any) {
    return this.communicationsService.sendNotification(data);
  }

  @Get('user-notifications')
  @ApiOperation({ summary: 'Get notifications for current active user' })
  async getUserNotifications() {
    return this.communicationsService.getNotifications('user-active');
  }

  @Get('user/:recipientId')
  @ApiOperation({ summary: 'Get notifications for user' })
  async getForUser(@Param('recipientId') recipientId: string) {
    return this.communicationsService.getNotifications(recipientId);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async read(@Param('id') id: string) {
    return this.communicationsService.markAsRead(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  async deleteNotification(@Param('id') id: string) {
    return this.communicationsService.deleteNotification(id);
  }

  @Post('clear-read/:recipientId')
  @ApiOperation({ summary: 'Clear read notifications' })
  async clearReadNotifications(@Param('recipientId') recipientId: string) {
    return this.communicationsService.clearReadNotifications(recipientId);
  }
}
