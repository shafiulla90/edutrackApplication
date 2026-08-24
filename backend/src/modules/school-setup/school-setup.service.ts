import { Injectable, Inject } from '@nestjs/common';
import { ITenantRepository } from '../../common/interfaces/tenant.repository.interface';

@Injectable()
export class SchoolSetupService {
  constructor(@Inject('ITenantRepository') private readonly tenantRepo: ITenantRepository) {}

  async getSchoolSetup(tenantId: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) {
      return { success: false, message: 'Tenant not found' };
    }

    return {
      success: true,
      id: tenant.id,
      schoolName: tenant.name || 'EduTrack School',
      schoolType: tenant.schoolType || 'School',
      adminName: tenant.adminName || 'School Administrator',
      email: tenant.email || '',
      helpDeskPhone: tenant.helpDeskPhone || tenant.adminPhone || '',
      address: tenant.address || '',
      subDomain: tenant.subDomain || '',
      schoolLogo: tenant.logoUrl || null,
      adminPhoto: tenant.adminPhoto || tenant.adminAvatarUrl || null,
    };
  }

  async updateSchoolSetup(data: any, tenantId: string) {
    if (!tenantId) throw new Error('tenantId is required');

    const updatePayload: any = {};
    if (data.schoolName || data.name) updatePayload.name = data.schoolName || data.name;
    if (data.schoolType) updatePayload.schoolType = data.schoolType;
    if (data.adminName) updatePayload.adminName = data.adminName;
    if (data.email) updatePayload.email = data.email;
    if (data.helpDeskPhone || data.mobileNumber) updatePayload.helpDeskPhone = data.helpDeskPhone || data.mobileNumber;
    if (data.address) updatePayload.address = data.address;
    if (data.schoolLogo || data.logoUrl) updatePayload.logoUrl = data.schoolLogo || data.logoUrl;
    
    if (data.adminPhoto || data.adminAvatarUrl) {
      updatePayload.adminPhoto = data.adminPhoto || data.adminAvatarUrl;
      updatePayload.adminAvatarUrl = data.adminPhoto || data.adminAvatarUrl;
    }

    if (data.subdomain) updatePayload.subDomain = data.subdomain;
    if (data.title) updatePayload.title = data.title;
    updatePayload.updatedAt = new Date().toISOString();

    const updated = await this.tenantRepo.update(tenantId, updatePayload);

    return {
      success: true,
      message: 'School setup updated successfully in Cloud Firestore',
      setup: updated,
    };
  }
}
