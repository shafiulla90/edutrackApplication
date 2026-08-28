import * as fs from 'fs';
import * as path from 'path';

// Simple .env loader
function loadEnv() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...values] = trimmed.split('=');
        const val = values.join('=').replace(/^["']|["']$/g, '');
        if (key && !process.env[key.trim()]) {
          process.env[key.trim()] = val.trim();
        }
      }
    });
  }
}
loadEnv();

import { FirebaseService } from '../src/database/firebase.service';

async function resetTestFirestore() {
  console.log('====================================================');
  console.log('🧹 EduTrack Firebase Test Collection Cleanup Utility');
  console.log('====================================================\n');

  const firebaseService = new FirebaseService();
  await firebaseService.onModuleInit();
  const db = firebaseService.getFirestore();

  const collections = ['tenants', 'users', 'studentProfiles', 'staffProfiles', 'parentProfiles', 'subscriptionPlans', 'subscriptionOrders', 'subscriptionPayments', 'subscriptions', 'subscriptionInvoices', 'platformSettings', 'paymentGatewayConfigs', 'notifications'];

  console.log('Cleaning up root collections and subcollections...');
  for (const colName of collections) {
    const snapshot = await db.collection(colName).limit(500).get();
    if (snapshot.size > 0) {
      const batch = db.batch();
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      console.log(`Deleted ${snapshot.size} documents from collection: ${colName}`);
    }
  }

  await firebaseService.onModuleDestroy();
  console.log('\n✅ Firestore test cleanup completed cleanly.');
}

resetTestFirestore();
