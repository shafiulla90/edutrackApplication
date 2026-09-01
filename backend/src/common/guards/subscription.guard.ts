import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ISubscriptionRepository } from '../interfaces/subscription.repository.interface';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject('ISubscriptionRepository') private readonly subRepo: ISubscriptionRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    // Ignore for Super Admin or non-authenticated routes (handled by JwtAuthGuard)
    if (!user || user.role === 'SUPER_ADMIN') {
      return true;
    }

    // Allow access to subscription, payment, and auth routes even if expired
    const path = request.route?.path || request.path || '';
    if (
      path.includes('/api/subscription') ||
      path.includes('/api/payment') ||
      path.includes('/api/auth')
    ) {
      return true;
    }

    const tenantId = user.tenantId;
    if (!tenantId) return true;

    // Fetch active subscription for the tenant
    const sub = await this.subRepo.findActiveSubscription(tenantId);

    if (sub && sub.status === 'EXPIRED') {
       throw new ForbiddenException('Tenant subscription is expired. Please renew to access this resource.');
    }

    return true;
  }
}
