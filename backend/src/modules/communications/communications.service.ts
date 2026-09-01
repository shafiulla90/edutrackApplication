import { Injectable, Inject } from '@nestjs/common';
import { IOperationsRepository } from '../../common/interfaces/operations.repository.interface';
import { ITenantRepository } from '../../common/interfaces/tenant.repository.interface';

@Injectable()
export class CommunicationsService {
  constructor(
    @Inject('IOperationsRepository') private readonly opsRepo: IOperationsRepository,
    @Inject('ITenantRepository') private readonly tenantRepo: ITenantRepository,
  ) {}

  async sendNotification(data: any) {
    return this.opsRepo.createNotification({
      title: data.title,
      message: data.message,
      type: data.type || 'IN_APP',
      recipientId: data.recipientId || 'user-active',
      isRead: false,
      createdAt: new Date().toISOString(),
    });
  }

  async getNotifications(recipientId: string) {
    const list = await this.opsRepo.findNotificationsByUser(recipientId || 'user-active');
    return list || [];
  }

  async markAsRead(id: string) {
    return this.opsRepo.markNotificationRead(id);
  }

  async deleteNotification(id: string) {
    return { success: true, id };
  }

  async clearReadNotifications(recipientId: string) {
    return { success: true, recipientId };
  }
}
