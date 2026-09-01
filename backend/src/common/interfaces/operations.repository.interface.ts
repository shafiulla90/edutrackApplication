export interface IOperationsRepository {
  findComplaintsByTenant(tenantId: string): Promise<any[]>;
  createComplaint(data: any): Promise<any>;
  updateComplaint(id: string, data: any): Promise<any>;
  findNotificationsByUser(recipientId: string): Promise<any[]>;
  createNotification(data: any): Promise<any>;
  markNotificationRead(id: string): Promise<any>;
  logActivity(data: any): Promise<any>;
}
