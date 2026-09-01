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

  async findByPhone(phone: string): Promise<any | null> {
    const cleaned = (phone || '').replace(/[\s\-()]/g, '');
    const cleanNoCountry = cleaned.replace(/^\+91/, '');

    const snap = await this.db.collection('users').where('phone', '==', cleaned).limit(1).get().catch(() => null);
    if (snap && !snap.empty) {
      const doc = snap.docs[0];
      return { id: doc.id, ...doc.data() };
    }

    const snap2 = await this.db.collection('users').where('phone', '==', cleanNoCountry).limit(1).get().catch(() => null);
    if (snap2 && !snap2.empty) {
      const doc = snap2.docs[0];
      return { id: doc.id, ...doc.data() };
    }

    const snap3 = await this.db.collection('users').where('mobileNumber', '==', cleanNoCountry).limit(1).get().catch(() => null);
    if (snap3 && !snap3.empty) {
      const doc = snap3.docs[0];
      return { id: doc.id, ...doc.data() };
    }

    const staffSnap = await this.db.collection('staffProfiles').where('phone', '==', cleanNoCountry).limit(1).get().catch(() => null);
    if (staffSnap && !staffSnap.empty) {
      const staff = staffSnap.docs[0].data();
      if (staff.userId) {
        return this.findById(staff.userId);
      }
    }

    const tenantSnap = await this.db.collection('tenants').where('adminPhone', '==', cleanNoCountry).limit(1).get().catch(() => null);
    if (tenantSnap && !tenantSnap.empty) {
      const tenant = tenantSnap.docs[0].data();
      return { id: `admin-${tenantSnap.docs[0].id}`, role: 'SCHOOL_ADMIN', tenantId: tenantSnap.docs[0].id, tenant };
    }

    return null;
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
