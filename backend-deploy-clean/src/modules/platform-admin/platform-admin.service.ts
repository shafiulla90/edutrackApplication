import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { encrypt, decrypt } from '../../common/utils/crypto.util';
import { IPlatformAdminRepository } from '../../common/interfaces/platform-admin.repository.interface';
import { ITenantRepository } from '../../common/interfaces/tenant.repository.interface';
import { ISubscriptionRepository } from '../../common/interfaces/subscription.repository.interface';

@Injectable()
export class PlatformAdminService {
  constructor(
    @Inject('IPlatformAdminRepository') private readonly adminRepo: IPlatformAdminRepository,
    @Inject('ITenantRepository') private readonly tenantRepo: ITenantRepository,
    @Inject('ISubscriptionRepository') private readonly subRepo: ISubscriptionRepository,
  ) {}

  async getDashboardMetrics() {
    const schools = await this.tenantRepo.findAll();
    const plans = await this.subRepo.findPlans();
    
    return {
      totalSchools: schools.length,
      activeSubscriptions: plans.length,
      totalRevenue: 0,
    };
  }

  async getAllSchools() {
    return this.tenantRepo.findAll();
  }

  async updateSchoolStatus(tenantId: string, status: string) {
    return this.tenantRepo.update(tenantId, { setupCompleted: status === 'ACTIVE' });
  }

  async getSubscriptionPlans() {
    return this.subRepo.findPlans();
  }

  async createSubscriptionPlan(data: any) {
    return this.subRepo.createOrder(data);
  }

  async updateSubscriptionPlan(id: string, data: any) {
    return this.subRepo.findPlanById(id);
  }

  async getPlatformSettings() {
    const settings = await this.adminRepo.getSettings();
    return settings || {};
  }

  async updatePlatformSettings(data: any) {
    let settings = await this.adminRepo.getSettings();
    if (settings) {
      return this.adminRepo.updateSettings(settings.id, data);
    } else {
      return this.adminRepo.updateSettings('ps-001', data);
    }
  }

  async getPaymentGateways() {
    const gateways = await this.adminRepo.getGatewayConfigs();
    return gateways.map((gw) => ({
      ...gw,
      keySecret: gw.keySecret ? '******' : null,
      webhookSecret: gw.webhookSecret ? '******' : null,
    }));
  }

  async updatePaymentGateway(gatewayName: string, data: any) {
    const gateways = await this.adminRepo.getGatewayConfigs();
    const config = gateways.find((g) => g.gatewayName === gatewayName);
    
    const updateData: any = {
      merchantName: data.merchantName,
      mode: data.mode,
      isActive: data.isActive,
    };

    if (data.keyId) updateData.keyId = encrypt(data.keyId);
    if (data.keySecret && data.keySecret !== '******') updateData.keySecret = encrypt(data.keySecret);
    if (data.webhookSecret && data.webhookSecret !== '******') updateData.webhookSecret = encrypt(data.webhookSecret);

    if (config) {
      return this.adminRepo.updateGatewayConfig(config.id, updateData);
    } else {
      return this.adminRepo.updateGatewayConfig('pgc-001', updateData);
    }
  }

  async getAllPayments() {
    return this.subRepo.findPlans();
  }

  async getAllInvoices() {
    return this.subRepo.findPlans();
  }
}
