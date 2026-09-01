import { Injectable, Inject } from '@nestjs/common';
import { ITenantRepository } from '../../common/interfaces/tenant.repository.interface';

@Injectable()
export class SchoolSetupService {
  constructor(@Inject('ITenantRepository') private readonly tenantRepo: ITenantRepository) {}

  async getSchoolSetup(tenantId?: string) {
    const tenants = await this.tenantRepo.findAll();
    const tenant = tenants.find((t: any) => t.id === tenantId) || tenants[0] || {
      id: 'tenant-test-001',
      name: 'A.P. Greenwood High School',
      schoolType: 'School',
      adminName: 'School Administrator',
      email: 'apgreenwoodschool@gmail.com',
      helpDeskPhone: '9642402639',
      subDomain: 'apgreenwoodschool',
    };

    return {
      success: true,
      id: tenant.id,
      schoolName: tenant.name || 'A.P. Greenwood High School',
      schoolType: tenant.schoolType || 'School',
      adminName: tenant.adminName || 'School Administrator',
      email: tenant.email || 'apgreenwoodschool@gmail.com',
      helpDeskPhone: tenant.helpDeskPhone || tenant.adminPhone || '9642402639',
      address: tenant.address || 'Greenwood Campus',
      subDomain: tenant.subDomain || 'apgreenwoodschool',
      schoolLogo: tenant.logoUrl || null,
      adminPhoto: tenant.adminPhoto || null,
    };
  }

  async updateSchoolSetup(data: any, tenantId?: string) {
    const tenants = await this.tenantRepo.findAll();
    const primaryTenant = tenants.find((t: any) => t.id === tenantId) || tenants[0];
    const idToUpdate = primaryTenant ? primaryTenant.id : 'tenant-test-001';

    const updatePayload: any = {};
    if (data.schoolName || data.name) updatePayload.name = data.schoolName || data.name;
    if (data.schoolType) updatePayload.schoolType = data.schoolType;
    if (data.adminName) updatePayload.adminName = data.adminName;
    if (data.email) updatePayload.email = data.email;
    if (data.helpDeskPhone || data.mobileNumber) updatePayload.helpDeskPhone = data.helpDeskPhone || data.mobileNumber;
    if (data.address) updatePayload.address = data.address;
    if (data.schoolLogo || data.logoUrl) updatePayload.logoUrl = data.schoolLogo || data.logoUrl;
    if (data.adminPhoto) updatePayload.adminPhoto = data.adminPhoto;
    if (data.subdomain) updatePayload.subDomain = data.subdomain;
    if (data.title) updatePayload.title = data.title;
    updatePayload.updatedAt = new Date().toISOString();

    const updated = await this.tenantRepo.update(idToUpdate, updatePayload);

    return {
      success: true,
      message: 'School setup updated successfully in Cloud Firestore',
      setup: updated,
    };
  }
}
