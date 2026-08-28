import { Injectable, Logger } from '@nestjs/common';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

@Injectable()
export class TenantCacheService {
  private readonly logger = new Logger(TenantCacheService.name);
  private cache = new Map<string, CacheEntry<any>>();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlSeconds: number = 30): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { data, expiresAt });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  invalidateTenant(tenantId: string): void {
    if (!tenantId) return;
    const prefix = `tenant:${tenantId}:`;
    const parentPrefix = `parent:${tenantId}:`;
    
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix) || key.startsWith(parentPrefix)) {
        this.cache.delete(key);
      }
    }
    this.logger.log(`Invalidated all cache entries for tenant: ${tenantId}`);
  }

  invalidateKey(key: string): void {
    this.cache.delete(key);
  }

  // Key builders
  static brandingKey(tenantId: string): string {
    return `tenant:${tenantId}:branding`;
  }

  static setupStatusKey(tenantId: string): string {
    return `tenant:${tenantId}:setup-status`;
  }

  static classesKey(tenantId: string): string {
    return `tenant:${tenantId}:classes-map`;
  }

  static parentChildrenKey(tenantId: string, parentUserId: string): string {
    return `parent:${tenantId}:${parentUserId}:children`;
  }
}
