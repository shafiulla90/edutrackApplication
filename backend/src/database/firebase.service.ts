import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import * as fs from 'fs';
import * as path from 'path';

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

    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson) {
      try {
        this.logger.log(`Initializing Firebase Admin SDK using FIREBASE_SERVICE_ACCOUNT_JSON env var`);
        const serviceAccount = JSON.parse(serviceAccountJson);
        if (serviceAccount && serviceAccount.private_key) {
          credential = cert(serviceAccount);
        } else {
          this.logger.warn('FIREBASE_SERVICE_ACCOUNT_JSON provided but lacks private_key');
        }
      } catch (err) {
        this.logger.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON', err);
      }
    }

    const candidatePaths = [
      path.join(process.cwd(), 'firebase-service-account.json'),
      path.join(process.cwd(), 'backend', 'firebase-service-account.json'),
      path.join(__dirname, '..', '..', '..', 'firebase-service-account.json'),
      path.join(__dirname, '..', '..', '..', 'backend', 'firebase-service-account.json')
    ];

    for (const saPath of candidatePaths) {
      if (!credential && fs.existsSync(saPath)) {
        try {
          this.logger.log(`Initializing Firebase Admin SDK using file: ${saPath}`);
          const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));
          if (serviceAccount.private_key) {
            credential = cert(serviceAccount);
            break;
          }
        } catch (err) {
          this.logger.error(`Failed to parse ${saPath}`, err);
        }
      }
    }

    if (!credential && credentialsPath && fs.existsSync(credentialsPath)) {
      try {
        this.logger.log(`Initializing Firebase Admin SDK using credential file: ${credentialsPath}`);
        const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
        if (serviceAccount.private_key) {
          credential = cert(serviceAccount);
        }
      } catch (err) {
        this.logger.error(`Failed to parse credentialsPath ${credentialsPath}`, err);
      }
    }

    if (!credential && clientEmail && privateKey) {
      this.logger.log(`Initializing Firebase Admin SDK using environment variable credentials`);
      credential = cert({
        projectId,
        clientEmail,
        privateKey,
      });
    }

    if (!credential) {
      try {
        const bundledSa = require('../../firebase-service-account.json');
        if (bundledSa && bundledSa.private_key) {
          this.logger.log(`Initializing Firebase Admin SDK using bundled firebase-service-account.json`);
          credential = cert(bundledSa);
        }
      } catch (e) {
        try {
          const bundledSaRoot = require('../../../backend/firebase-service-account.json');
          if (bundledSaRoot && bundledSaRoot.private_key) {
            this.logger.log(`Initializing Firebase Admin SDK using root bundled service account`);
            credential = cert(bundledSaRoot);
          }
        } catch (e2) {}
      }
    }

    if (credential) {
      this.firebaseApp = initializeApp({ credential, projectId });
    } else {
      this.logger.log(`Initializing Firebase Admin SDK with project ID default credentials: ${projectId}`);
      this.firebaseApp = initializeApp({ projectId });
    }

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
