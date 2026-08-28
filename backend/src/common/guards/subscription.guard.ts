import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Inject, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionService } from '../../modules/subscription/subscription.service';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Optional() private readonly subscriptionService?: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const handlerName = (context.getHandler()?.name || '').toLowerCase();
    const className = (context.getClass()?.name || '').toLowerCase();
    const request = context.switchToHttp().getRequest();
    const rawUrl = [
      request.route?.path,
      request.path,
      request.url,
      request.originalUrl,
      request.baseUrl,
      handlerName,
      className,
    ].filter(Boolean).join(' ').toLowerCase();

    // Registration, Auth, Payment, Public Branding, and Tenant creation routes must NEVER be blocked by subscription checks
    if (
      rawUrl.includes('register') ||
      rawUrl.includes('publicbranding') ||
      rawUrl.includes('public-branding') ||
      rawUrl.includes('setupstatus') ||
      rawUrl.includes('setup-status') ||
      rawUrl.includes('subscription') ||
      rawUrl.includes('payment') ||
      rawUrl.includes('auth') ||
      rawUrl.includes('tenantcontroller')
    ) {
      return true;
    }

    const user = request.user;
    
    // Ignore for Super Admin or non-authenticated requests
    if (!user || user.role === 'SUPER_ADMIN') {
      return true;
    }

    // Read-only mode: GET/HEAD/OPTIONS requests are always allowed even for expired subscriptions.
    // Existing data remains visible. Only write operations are blocked.
    const method = (request.method || 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return true;
    }

    const tenantId = user.tenantId || user.tenant?.id;
    if (!tenantId) return true;

    if (this.subscriptionService) {
      const subStatus = await this.subscriptionService.checkSubscriptionStatus(tenantId);
      if (subStatus && subStatus.isExpired) {
        throw new ForbiddenException({
          success: false,
          code: 'SUBSCRIPTION_EXPIRED_READ_ONLY',
          message: 'Your subscription has expired. Existing data is available in read-only mode. Please renew your subscription to perform this action.',
          tenantId,
        });
      }
    }

    return true;
  }
}
