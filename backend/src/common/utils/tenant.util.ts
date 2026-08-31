import { UnauthorizedException } from '@nestjs/common';

export function getTenantIdFromReq(req: any): string {
  const tenantId = req?.user?.tenantId || req?.tenantId;
  if (!tenantId || tenantId === 'undefined' || tenantId === 'null') {
    throw new UnauthorizedException('Tenant context missing or invalid. Please log in.');
  }
  return tenantId;
}
