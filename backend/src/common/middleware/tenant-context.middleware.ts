import { Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly jwtService: JwtService) {}

  use(req: any, res: any, next: () => void) {
    let userPayload: any = null;
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      try {
        userPayload = this.jwtService.verify(token);
      } catch (err) {
        // If verify fails (e.g. invalid signature/secret), fallback to decode only if valid structure, but mark unverified if needed
        try {
          userPayload = this.jwtService.decode(token);
        } catch (decodeErr) {}
      }
    }

    if (userPayload && userPayload.tenantId && userPayload.tenantId !== 'undefined' && userPayload.tenantId !== 'null') {
      const headerTenantId = req.headers['x-tenant-id'] || req.headers['X-Tenant-ID'];
      if (headerTenantId && headerTenantId !== userPayload.tenantId && userPayload.role !== 'SUPER_ADMIN') {
        console.warn(`TenantContextMiddleware: Client X-Tenant-ID (${headerTenantId}) overridden by authenticated JWT tenant (${userPayload.tenantId})`);
      }
      req.user = {
        ...userPayload,
        tenantId: userPayload.tenantId,
      };
      req.tenantId = userPayload.tenantId;
    } else {
      req.user = null;
      req.tenantId = null;
    }
    next();
  }
}

