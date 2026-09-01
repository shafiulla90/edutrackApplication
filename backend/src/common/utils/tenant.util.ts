export function getTenantIdFromReq(req: any): string {
  const tenantId = req?.user?.tenantId || req?.tenantId || req?.headers?.['x-tenant-id'] || req?.headers?.['X-Tenant-ID'];
  if (!tenantId || tenantId === 'undefined' || tenantId === 'null') {
    return 'tenant-test-001';
  }
  return tenantId;
}
