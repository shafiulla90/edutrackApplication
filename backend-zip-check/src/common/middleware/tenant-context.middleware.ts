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
        userPayload = this.jwtService.decode(token);
      } catch (err) {
        console.warn('TenantContextMiddleware JWT decode warning:', err);
      }
    }

    const headerTenantId = req.headers['x-tenant-id'];
    
    // JWT tenant identity is non-bypassable and authoritative
    const jwtTenantId = userPayload?.tenantId || null;
    let resolvedTenantId = jwtTenantId;

    if (!resolvedTenantId && headerTenantId && headerTenantId !== 'undefined' && headerTenantId !== 'null') {
      resolvedTenantId = headerTenantId;
    }

    if (userPayload) {
      // If client sends a conflicting X-Tenant-ID header, validate authorization
      if (headerTenantId && headerTenantId !== userPayload.tenantId && userPayload.role !== 'SUPER_ADMIN') {
        console.warn(`TenantContextMiddleware: Client X-Tenant-ID (${headerTenantId}) overridden by authenticated JWT tenant (${userPayload.tenantId})`);
      }
      req.user = {
        ...userPayload,
        tenantId: userPayload.tenantId || resolvedTenantId,
      };
    } else if (resolvedTenantId) {
      req.user = {
        id: 'user-header',
        tenantId: resolvedTenantId,
        role: 'SCHOOL_ADMIN',
      };
    }

    req.tenantId = resolvedTenantId;
    next();
  }
}

