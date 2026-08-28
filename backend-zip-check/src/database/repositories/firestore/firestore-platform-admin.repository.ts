import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase.service';
import { IPlatformAdminRepository } from '../../../common/interfaces/platform-admin.repository.interface';

@Injectable()
export class FirestorePlatformAdminRepository implements IPlatformAdminRepository {
  constructor(private readonly firebase: FirebaseService) {}

  private get db() {
    return this.firebase.getFirestore();
  }

  async getSettings(): Promise<any | null> {
    const snap = await this.db.collection('platformSettings').limit(1).get();
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
  }

  async updateSettings(id: string, data: any): Promise<any> {
    const ref = this.db.collection('platformSettings').doc(id);
    await ref.set(data, { merge: true });
    const doc = await ref.get();
    return { id: doc.id, ...doc.data() };
  }

  async getGatewayConfigs(): Promise<any[]> {
    const snap = await this.db.collection('paymentGatewayConfigs').get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async updateGatewayConfig(id: string, data: any): Promise<any> {
    const ref = this.db.collection('paymentGatewayConfigs').doc(id);
    await ref.set(data, { merge: true });
    const doc = await ref.get();
    return { id: doc.id, ...doc.data() };
  }
}
