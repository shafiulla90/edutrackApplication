import { Injectable, Inject } from '@nestjs/common';
import { FirebaseService } from '../../database/firebase.service';

export interface DashboardStats {
  studentsCount: number;
  teachersCount: number;
  classesCount: number;
  completionPercentage: number;
  setupCompleted: boolean;
}

@Injectable()
export class DashboardStatsService {
  constructor(private readonly firebase: FirebaseService) {}

  private get db() {
    return this.firebase.getFirestore();
  }

  /**
   * Centralized single source of truth for tenant-scoped counts & setup stats.
   * Used by both /tenant/setup-status and /dashboard/summary.
   */
  async getTenantStats(tenantId: string): Promise<DashboardStats> {
    const tid = tenantId && tenantId !== 'undefined' && tenantId !== 'null' ? tenantId : 'tenant-test-001';

    // Run tenant-scoped queries in parallel using Promise.all
    const [studentsSnap, staffSnap, usersSnap, classesSnap, tenantDoc] = await Promise.all([
      // 1. Students count for current tenant
      this.db.collection('studentProfiles').where('tenantId', '==', tid).count().get().catch(async () => {
        const snap = await this.db.collection('studentProfiles').where('tenantId', '==', tid).get();
        return { data: () => ({ count: snap.size }) };
      }),

      // 2. Staff profiles count for current tenant
      this.db.collection('staffProfiles').where('tenantId', '==', tid).count().get().catch(async () => {
        const snap = await this.db.collection('staffProfiles').where('tenantId', '==', tid).get();
        return { data: () => ({ count: snap.size }) };
      }),

      // 3. Fallback/supplemental teacher users count if staffProfiles count is 0
      this.db.collection('users').where('tenantId', '==', tid).where('role', '==', 'TEACHER').count().get().catch(async () => {
        const snap = await this.db.collection('users').where('tenantId', '==', tid).where('role', '==', 'TEACHER').get();
        return { data: () => ({ count: snap.size }) };
      }),

      // 4. Classes count for current tenant
      this.db.collection('tenants').doc(tid).collection('classes').count().get().catch(async () => {
        const snap = await this.db.collection('tenants').doc(tid).collection('classes').get();
        return { data: () => ({ count: snap.size }) };
      }),

      // 5. Tenant profile document for setup status
      this.db.collection('tenants').doc(tid).get().catch(() => null),
    ]);

    const studentsCount = (studentsSnap as any).data().count || 0;
    
    // Teachers count: use staffProfiles count, or teacher users count if staffProfiles is smaller
    const staffProfilesCount = (staffSnap as any).data().count || 0;
    const teacherUsersCount = (usersSnap as any).data().count || 0;
    const teachersCount = Math.max(staffProfilesCount, teacherUsersCount);

    const classesCount = (classesSnap as any).data().count || 0;

    // Calculate Profile Completion Percentage
    const tenantData = tenantDoc && tenantDoc.exists ? tenantDoc.data() : {};
    const checkFields = [
      tenantData?.name || tenantData?.schoolName,
      tenantData?.adminName,
      tenantData?.email,
      tenantData?.adminPhone || tenantData?.helpDeskPhone || tenantData?.phone,
      tenantData?.address,
    ];

    const filledCount = checkFields.filter((val) => val && String(val).trim().length > 0).length;
    const completionPercentage = Math.round((filledCount / checkFields.length) * 100);
    const setupCompleted = completionPercentage === 100;

    return {
      studentsCount,
      teachersCount,
      classesCount,
      completionPercentage,
      setupCompleted,
    };
  }
}
