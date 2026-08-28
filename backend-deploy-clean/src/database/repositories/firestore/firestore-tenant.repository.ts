import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase.service';
import { ITenantRepository } from '../../../common/interfaces/tenant.repository.interface';

@Injectable()
export class FirestoreTenantRepository implements ITenantRepository {
  constructor(private readonly firebase: FirebaseService) {}

  private get db() {
    return this.firebase.getFirestore();
  }

  async findAll(): Promise<any[]> {
    const snap = await this.db.collection('tenants').get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async findById(id: string): Promise<any | null> {
    const doc = await this.db.collection('tenants').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  async findBySubdomain(subDomain: string): Promise<any | null> {
    const snap = await this.db.collection('tenants').where('subDomain', '==', subDomain).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  private sanitizePayload(data: any): any {
    if (!data || typeof data !== 'object') return data;
    const clean: any = Array.isArray(data) ? [] : {};
    for (const key of Object.keys(data)) {
      if (data[key] !== undefined) {
        clean[key] = data[key];
      }
    }
    return clean;
  }

  async create(data: any): Promise<any> {
    const ref = data.id ? this.db.collection('tenants').doc(data.id) : this.db.collection('tenants').doc();
    const payload = this.sanitizePayload({ ...data, id: ref.id });
    await ref.set(payload, { merge: true });
    return payload;
  }

  async update(id: string, data: any): Promise<any> {
    const ref = this.db.collection('tenants').doc(id);
    const clean = this.sanitizePayload(data);
    await ref.set(clean, { merge: true });
    const doc = await ref.get();
    return { id: doc.id, ...doc.data() };
  }

  async delete(id: string): Promise<any> {
    const ref = this.db.collection('tenants').doc(id);
    const doc = await ref.get();
    const data = doc.exists ? { id: doc.id, ...doc.data() } : null;
    await ref.delete();
    return data;
  }
}
