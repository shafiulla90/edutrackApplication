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
    const resolvedTenantId =
      userPayload?.tenantId ||
      (headerTenantId && headerTenantId !== 'undefined' && headerTenantId !== 'null' ? headerTenantId : null);

    if (userPayload) {
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
