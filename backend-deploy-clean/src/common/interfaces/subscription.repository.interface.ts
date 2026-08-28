export interface ISubscriptionRepository {
  findPlans(): Promise<any[]>;
  findPlanById(id: string): Promise<any | null>;
  createOrder(data: any): Promise<any>;
  findOrderById(id: string): Promise<any | null>;
  createPayment(data: any): Promise<any>;
  createSubscription(data: any): Promise<any>;
  findActiveSubscription(tenantId: string): Promise<any | null>;
}
