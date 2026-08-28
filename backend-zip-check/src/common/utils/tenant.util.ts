import { UnauthorizedException } from '@nestjs/common';

export function getTenantIdFromReq(req: any): string {
  const tenantId = req?.user?.tenantId || req?.headers?.['x-tenant-id'];
  if (!tenantId || tenantId === 'undefined') {
    throw new UnauthorizedException('Tenant context missing or invalid');
  }
  return tenantId;
}
