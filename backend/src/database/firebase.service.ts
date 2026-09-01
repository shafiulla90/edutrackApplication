import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import * as fs from 'fs';

@Injectable()
export class FirebaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FirebaseService.name);
  private firebaseApp: App;
  private firestoreDb: Firestore;

  async onModuleInit() {
    this.initFirebase();
  }

  private initFirebase() {
    if (getApps().length > 0) {
      this.firebaseApp = getApps()[0]!;
      this.firestoreDb = getFirestore(this.firebaseApp);
      return;
    }

    const projectId = process.env.FIREBASE_PROJECT_ID || 'edutrack-52e6c';
    const credentialsPath = process.env.FIREBASE_CREDENTIALS_PATH;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (privateKey) {
      privateKey = privateKey.trim();
      if ((privateKey.startsWith('"') && privateKey.endsWith('"')) || (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
        privateKey = privateKey.substring(1, privateKey.length - 1);
      }
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    let credential;

    if (credentialsPath && fs.existsSync(credentialsPath)) {
      this.logger.log(`Initializing Firebase Admin SDK using credential file: ${credentialsPath}`);
      const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
      credential = cert(serviceAccount);
    } else if (clientEmail && privateKey) {
      this.logger.log(`Initializing Firebase Admin SDK using environment variable credentials`);
      credential = cert({
        projectId,
        clientEmail,
        privateKey,
      });
    } else {
      this.logger.log(`Initializing Firebase Admin SDK with project ID: ${projectId}`);
      credential = cert({ projectId });
    }

    this.firebaseApp = initializeApp({
      credential,
      projectId,
    });

    this.firestoreDb = getFirestore(this.firebaseApp);
    this.logger.log(`Firebase Admin SDK initialized successfully for project: ${projectId}`);
  }

  getFirestore(): Firestore {
    if (!this.firestoreDb) {
      this.initFirebase();
    }
    return this.firestoreDb;
  }

  getAuth(): Auth {
    if (!this.firebaseApp) {
      this.initFirebase();
    }
    return getAuth(this.firebaseApp);
  }

  async onModuleDestroy() {
    this.logger.log(`Firebase Admin SDK connection closed.`);
  }
}
