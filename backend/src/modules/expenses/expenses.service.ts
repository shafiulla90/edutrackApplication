import { Injectable, Inject } from '@nestjs/common';
import { IBillingRepository } from '../../common/interfaces/billing.repository.interface';

@Injectable()
export class ExpensesService {
  constructor(
    @Inject('IBillingRepository') private readonly billingRepo: IBillingRepository
  ) {}

  async createExpense(data: any, tenantId?: string) {
    const tid = tenantId || 'tenant-test-001';
    return this.billingRepo.createExpense({ ...data, tenantId: tid });
  }

  async getExpenses(category?: string, status?: string, tenantId?: string) {
    const tid = tenantId || 'tenant-test-001';
    const list = await this.billingRepo.findExpensesByTenant(tid);
    let filtered = list || [];
    if (category) {
      filtered = filtered.filter((e: any) => e.category === category);
    }
    if (status) {
      filtered = filtered.filter((e: any) => e.status === status);
    }
    return filtered;
  }

  async getExpenseSummary(tenantId?: string) {
    const tid = tenantId || 'tenant-test-001';
    const list = await this.billingRepo.findExpensesByTenant(tid);
    const totalAmount = (list || []).reduce((sum, e) => sum + Number(e.amount || 0), 0);
    return {
      totalExpenses: list.length,
      totalAmount,
      currency: 'INR',
    };
  }

  async updateExpense(id: string, data: any, tenantId?: string) {
    const tid = tenantId || 'tenant-test-001';
    if (this.billingRepo.updateExpense) {
      return this.billingRepo.updateExpense(id, data, tid);
    }
    return { id, ...data, updatedAt: new Date().toISOString() };
  }

  async deleteExpense(id: string, tenantId?: string) {
    const tid = tenantId || 'tenant-test-001';
    if (this.billingRepo.deleteExpense) {
      return this.billingRepo.deleteExpense(id, tid);
    }
    return { success: true, id };
  }
}
