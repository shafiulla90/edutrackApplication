import * as fs from 'fs';
import * as path from 'path';

// Simple .env parser to avoid external dependencies
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

async function testConnection() {
  console.log('--- Testing Firebase Admin SDK Connection ---');
  console.log(`Project ID: ${process.env.FIREBASE_PROJECT_ID}`);
  console.log(`Client Email: ${process.env.FIREBASE_CLIENT_EMAIL}`);
  console.log(`Credentials Path: ${process.env.FIREBASE_CREDENTIALS_PATH}`);

  try {
    const firebaseService = new FirebaseService();
    await firebaseService.onModuleInit();

    const db = firebaseService.getFirestore();
    console.log('Pinging Cloud Firestore...');

    const collections = await db.listCollections();
    console.log('✅ Firebase Cloud Firestore connection successful!');
    console.log(`Current Root Collections Count: ${collections.length}`);
    if (collections.length > 0) {
      console.log('Existing collections:', collections.map((col) => col.id).join(', '));
    } else {
      console.log('No root collections present yet (Ready for Phase 5 data migration).');
    }

    await firebaseService.onModuleDestroy();
    console.log('--- Test Completed Successfully ---');
    process.exit(0);
  } catch (error) {
    console.error('❌ Firebase connection test failed:', error);
    process.exit(1);
  }
}

testConnection();
