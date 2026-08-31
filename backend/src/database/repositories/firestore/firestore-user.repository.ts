import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase.service';
import { IUserRepository } from '../../../common/interfaces/user.repository.interface';

function sanitizePayload(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(sanitizePayload);
  const clean: any = {};
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) {
      clean[key] = sanitizePayload(obj[key]);
    }
  }
  return clean;
}

@Injectable()
export class FirestoreUserRepository implements IUserRepository {
  constructor(private readonly firebase: FirebaseService) {}

  private get db() {
    return this.firebase.getFirestore();
  }

  async findById(id: string): Promise<any | null> {
    const doc = await this.db.collection('users').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  async findByEmail(email: string): Promise<any | null> {
    const snap = await this.db.collection('users').where('email', '==', email).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  async findAnyUserByPhone(phone: string): Promise<any | null> {
    const cleaned = (phone || '').replace(/[\s\-()]/g, '');
    const cleanNoCountry = cleaned.replace(/^\+91/, '');
    const formattedWithCountry = `+91${cleanNoCountry}`;

    // Query users collection
    const candidatesMap = new Map<string, any>();
    const userQueries = [
      this.db.collection('users').where('phone', '==', cleaned).get(),
      this.db.collection('users').where('phone', '==', cleanNoCountry).get(),
      this.db.collection('users').where('phone', '==', formattedWithCountry).get(),
      this.db.collection('users').where('mobileNumber', '==', cleanNoCountry).get(),
    ];

    const results = await Promise.all(userQueries.map(q => q.catch(() => null)));
    results.forEach(snap => {
      if (snap && !snap.empty) {
        snap.docs.forEach(doc => {
          candidatesMap.set(doc.id, { id: doc.id, ...doc.data() });
        });
      }
    });

    const candidates = Array.from(candidatesMap.values());
    if (candidates.length > 0) {
      return candidates[0];
    }

    // Check staffProfiles for Teachers
    const staffSnap = await this.db.collection('staffProfiles').where('phone', '==', cleanNoCountry).get().catch(() => null);
    if (staffSnap && !staffSnap.empty) {
      const staff = staffSnap.docs[0].data();
      if (staff.userId) {
        const u = await this.findById(staff.userId);
        if (u) return u;
      }
      return { id: `staff-${staffSnap.docs[0].id}`, role: 'TEACHER', tenantId: staff.tenantId || '' };
    }

    // Check studentProfiles for Parent / Student phones
    const studentFields = ['phone', 'fatherPhone', 'motherPhone', 'parentPhone', 'guardianPhone', 'contactNumber'];
    const studentQueries = studentFields.map(field => 
      this.db.collection('studentProfiles').where(field, '==', cleanNoCountry).get()
    );
    const stdResults = await Promise.all(studentQueries.map(q => q.catch(() => null)));
    for (const snap of stdResults) {
      if (snap && !snap.empty) {
        const std = snap.docs[0].data();
        if (std.userId) {
          const u = await this.findById(std.userId);
          if (u) return u;
        }
        return { id: `student-${snap.docs[0].id}`, role: 'PARENT', tenantId: std.tenantId || '' };
      }
    }

    // Check tenants for Admin
    const tenantSnap = await this.db.collection('tenants').where('adminPhone', '==', cleanNoCountry).limit(1).get().catch(() => null);
    if (tenantSnap && !tenantSnap.empty) {
      const tenant = tenantSnap.docs[0].data();
      return { id: `admin-${tenantSnap.docs[0].id}`, role: 'SCHOOL_ADMIN', tenantId: tenantSnap.docs[0].id, tenant };
    }

    return null;
  }

  async findByPhone(phone: string, portal?: string): Promise<any | null> {
    const cleaned = (phone || '').replace(/[\s\-()]/g, '');
    const cleanNoCountry = cleaned.replace(/^\+91/, '');
    const formattedWithCountry = `+91${cleanNoCountry}`;

    // 1. If logging in via School Admin Portal, check tenants table first by adminPhone
    // 1. If logging in via School Admin Portal, check tenants table first across all phone variations
    if (portal === 'admin' || !portal) {
      const phoneVars = Array.from(new Set([cleanNoCountry, cleaned, formattedWithCountry].filter(Boolean)));
      const tenantQueries: Promise<any>[] = [];
      phoneVars.forEach(p => {
        tenantQueries.push(this.db.collection('tenants').where('adminPhone', '==', p).limit(1).get().catch(() => null));
        tenantQueries.push(this.db.collection('tenants').where('phone', '==', p).limit(1).get().catch(() => null));
        tenantQueries.push(this.db.collection('tenants').where('mobileNumber', '==', p).limit(1).get().catch(() => null));
      });
      const tenantSnaps = await Promise.all(tenantQueries);
      for (const snap of tenantSnaps) {
        if (snap && !snap.empty) {
          const tenantDoc = snap.docs[0];
          const tenant = tenantDoc.data();
          return {
            id: `admin-${tenantDoc.id}`,
            role: 'SCHOOL_ADMIN',
            tenantId: tenantDoc.id,
            tenant,
            phone: cleanNoCountry,
            email: tenant.email || '',
            name: tenant.adminName || tenant.name || 'School Administrator',
          };
        }
      }
    }

    // Target roles according to requested portal
    let targetRoles: string[] = [];
    if (portal === 'teacher') {
      targetRoles = ['TEACHER', 'STAFF', 'DRIVER'];
    } else if (portal === 'parent' || portal === 'student') {
      targetRoles = ['PARENT', 'STUDENT'];
    } else if (portal === 'admin') {
      targetRoles = ['SCHOOL_ADMIN', 'CORRESPONDENT', 'SUPER_ADMIN', 'ADMIN'];
    }

    // Query all users matching phone number variations
    const candidatesMap = new Map<string, any>();
    const queries = [
      this.db.collection('users').where('phone', '==', cleaned).get(),
      this.db.collection('users').where('phone', '==', cleanNoCountry).get(),
      this.db.collection('users').where('phone', '==', formattedWithCountry).get(),
      this.db.collection('users').where('mobileNumber', '==', cleanNoCountry).get(),
    ];

    const results = await Promise.all(queries.map(q => q.catch(() => null)));
    results.forEach(snap => {
      if (snap && !snap.empty) {
        snap.docs.forEach(doc => {
          candidatesMap.set(doc.id, { id: doc.id, ...doc.data() });
        });
      }
    });

    const candidates = Array.from(candidatesMap.values());

    // If targetRoles is specified, try to find matching user for requested portal
    if (targetRoles.length > 0) {
      const match = candidates.find(u => targetRoles.includes(u.role));
      if (match) return match;
    }

    // Fallback search in staffProfiles for teachers
    if (portal === 'teacher' || targetRoles.includes('TEACHER')) {
      const staffSnap = await this.db.collection('staffProfiles').where('phone', '==', cleanNoCountry).get().catch(() => null);
      if (staffSnap && !staffSnap.empty) {
        const staff = staffSnap.docs[0].data();
        if (staff.userId) {
          const u = await this.findById(staff.userId);
          if (u) return u;
        }
      }
    }

    // Fallback search in studentProfiles / parentProfiles for parents & students
    if (portal === 'parent' || portal === 'student' || targetRoles.includes('PARENT') || targetRoles.includes('STUDENT')) {
      const studentFields = ['phone', 'fatherPhone', 'motherPhone', 'parentPhone', 'guardianPhone', 'contactNumber'];
      const studentQueries = studentFields.map(field => 
        this.db.collection('studentProfiles').where(field, '==', cleanNoCountry).get()
      );
      const stdResults = await Promise.all(studentQueries.map(q => q.catch(() => null)));
      for (const snap of stdResults) {
        if (snap && !snap.empty) {
          const std = snap.docs[0].data();
          if (std.userId) {
            const u = await this.findById(std.userId);
            if (u) return u;
          }
        }
      }
    }

    // Fallback search in tenants for admin if not checked earlier
    if (portal === 'admin' || targetRoles.includes('SCHOOL_ADMIN')) {
      const tenantSnap = await this.db.collection('tenants').where('adminPhone', '==', cleanNoCountry).limit(1).get().catch(() => null);
      if (tenantSnap && !tenantSnap.empty) {
        const tenant = tenantSnap.docs[0].data();
        return {
          id: `admin-${tenantSnap.docs[0].id}`,
          role: 'SCHOOL_ADMIN',
          tenantId: tenantSnap.docs[0].id,
          tenant,
          phone: cleanNoCountry,
          email: tenant.email || '',
          name: tenant.adminName || tenant.name || 'School Administrator',
        };
      }
    }

    // If portal was specified but no role match was found for that portal, return null to prompt registration/error
    if (portal) {
      return null;
    }

    return candidates.length > 0 ? candidates[0] : null;
  }

  async findUserWithProfile(id: string): Promise<any | null> {
    const userDoc = await this.db.collection('users').doc(id).get();
    if (!userDoc.exists) return null;
    const userData = { id: userDoc.id, ...userDoc.data() };

    const [studentSnap, staffSnap, parentSnap] = await Promise.all([
      this.db.collection('studentProfiles').where('userId', '==', id).limit(1).get(),
      this.db.collection('staffProfiles').where('userId', '==', id).limit(1).get(),
      this.db.collection('parentProfiles').where('userId', '==', id).limit(1).get(),
    ]);

    return {
      ...userData,
      StudentProfile: !studentSnap.empty ? { id: studentSnap.docs[0].id, ...studentSnap.docs[0].data() } : null,
      StaffProfile: !staffSnap.empty ? { id: staffSnap.docs[0].id, ...staffSnap.docs[0].data() } : null,
      ParentProfile: !parentSnap.empty ? { id: parentSnap.docs[0].id, ...parentSnap.docs[0].data() } : null,
    };
  }

  async findUsersByTenant(tenantId: string, role?: string): Promise<any[]> {
    let query: FirebaseFirestore.Query = this.db.collection('users').where('tenantId', '==', tenantId);
    if (role) query = query.where('role', '==', role);
    const snap = await query.get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async create(data: any): Promise<any> {
    const ref = data.id ? this.db.collection('users').doc(data.id) : this.db.collection('users').doc();
    const payload = sanitizePayload({ ...data, id: ref.id });
    await ref.set(payload, { merge: true });
    return payload;
  }

  async update(id: string, data: any): Promise<any> {
    const ref = this.db.collection('users').doc(id);
    const payload = sanitizePayload(data);
    await ref.set(payload, { merge: true });
    const doc = await ref.get();
    return { id: doc.id, ...doc.data() };
  }

  async delete(id: string): Promise<any> {
    const ref = this.db.collection('users').doc(id);
    const doc = await ref.get();
    const data = doc.exists ? { id: doc.id, ...doc.data() } : null;
    await ref.delete();
    return data;
  }
}
