import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { ISubscriptionRepository } from '../../common/interfaces/subscription.repository.interface';

@Injectable()
export class SubscriptionService {
  constructor(@Inject('ISubscriptionRepository') private readonly subRepo: ISubscriptionRepository) {}

  async assignFreePlanToNewTenant(tenantId: string) {
    let freePlan = await this.subRepo.findPlanById('free-plan-001');

    if (!freePlan) {
      const plans = await this.subRepo.findPlans();
      freePlan = plans.find((p) => p.name === 'Free Plan') || null;
    }

    const startDate = new Date();
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 6);

    return this.subRepo.createSubscription({
      tenantId,
      planId: freePlan ? freePlan.id : 'free-plan-001',
      startDate,
      expiryDate,
      status: 'ACTIVE',
    });
  }

  async checkSubscriptionStatus(tenantId: string) {
    const sub = await this.subRepo.findActiveSubscription(tenantId);
    if (!sub) {
      return { status: 'EXPIRED', daysRemaining: 0 };
    }
    const daysRemaining = Math.max(0, Math.ceil((new Date(sub.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    return { status: sub.status, daysRemaining };
  }

  async getAllPlans() {
    return this.subRepo.findPlans();
  }

  async getPaymentHistory(tenantId: string) {
    return this.subRepo.findPlans();
  }

  async getInvoices(tenantId: string) {
    return this.subRepo.findPlans();
  }
}
