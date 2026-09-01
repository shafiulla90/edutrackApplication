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
    const [studentsSnap, staffSnap, usersSnap, subClassesSnap, rootClassesSnap, tenantDoc] = await Promise.all([
      // 1. Students count for current tenant
      this.db.collection('studentProfiles').where('tenantId', '==', tid).get().catch(() => null),

      // 2. Staff profiles count for current tenant
      this.db.collection('staffProfiles').where('tenantId', '==', tid).get().catch(() => null),

      // 3. Users count for current tenant (single-field for max reliability)
      this.db.collection('users').where('tenantId', '==', tid).get().catch(() => null),

      // 4. Subcollection classes count
      this.db.collection('tenants').doc(tid).collection('classes').get().catch(() => null),

      // 5. Root collection classes count
      this.db.collection('classes').where('tenantId', '==', tid).get().catch(() => null),

      // 6. Tenant profile document
      this.db.collection('tenants').doc(tid).get().catch(() => null),
    ]);

    const studentsCount = studentsSnap ? studentsSnap.size : 0;
    const staffProfilesCount = staffSnap ? staffSnap.size : 0;

    let teacherUsersCount = 0;
    if (usersSnap && !usersSnap.empty) {
      teacherUsersCount = usersSnap.docs.filter(d => d.data()?.role === 'TEACHER').length;
    }

    const teachersCount = Math.max(staffProfilesCount, teacherUsersCount);

    const subClassesCount = subClassesSnap ? subClassesSnap.size : 0;
    const rootClassesCount = rootClassesSnap ? rootClassesSnap.size : 0;
    const classesCount = Math.max(subClassesCount, rootClassesCount);

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
