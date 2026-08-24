import { Injectable, Inject } from '@nestjs/common';
import { IBillingRepository } from '../../common/interfaces/billing.repository.interface';

@Injectable()
export class ExpensesService {
  constructor(
    @Inject('IBillingRepository') private readonly billingRepo: IBillingRepository
  ) {}

  async createExpense(data: any, tenantId: string) {
    if (!tenantId) throw new Error('tenantId is required');
    return this.billingRepo.createExpense({ ...data, tenantId });
  }

  async getExpenses(category?: string, status?: string, tenantId?: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const list = await this.billingRepo.findExpensesByTenant(tenantId);
    let filtered = list || [];
    if (category) {
      filtered = filtered.filter((e: any) => e.category === category);
    }
    if (status) {
      filtered = filtered.filter((e: any) => e.status === status);
    }
    return filtered;
  }

  async getExpenseSummary(tenantId: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const list = (await this.billingRepo.findExpensesByTenant(tenantId)) || [];
    const now = new Date();
    const currentYr = now.getFullYear();
    const currentMo = now.getMonth();

    let currentMonth = 0;
    let prevMonth = 0;
    let yearly = 0;

    for (const e of list) {
      const amt = Number(e.amount || 0);
      const dt = new Date(e.date || (e as any).createdAt);
      if (!isNaN(dt.getTime())) {
        if (dt.getFullYear() === currentYr) {
          yearly += amt;
          if (dt.getMonth() === currentMo) {
            currentMonth += amt;
          } else if (dt.getMonth() === currentMo - 1 || (currentMo === 0 && dt.getMonth() === 11 && dt.getFullYear() === currentYr - 1)) {
            prevMonth += amt;
          }
        }
      } else {
        yearly += amt;
        currentMonth += amt;
      }
    }

    return {
      currentMonth,
      prevMonth,
      yearly,
      totalExpenses: list.length,
      totalAmount: yearly,
      currency: 'INR',
    };
  }

  async updateExpense(id: string, data: any, tenantId: string) {
    if (!tenantId) throw new Error('tenantId is required');
    if (this.billingRepo.updateExpense) {
      return this.billingRepo.updateExpense(id, data, tenantId);
    }
    return { id, ...data, updatedAt: new Date().toISOString() };
  }

  async deleteExpense(id: string, tenantId: string) {
    if (!tenantId) throw new Error('tenantId is required');
    if (this.billingRepo.deleteExpense) {
      return this.billingRepo.deleteExpense(id, tenantId);
    }
    return { success: true, id };
  }
}
