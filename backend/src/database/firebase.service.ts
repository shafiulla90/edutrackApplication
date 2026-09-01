import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import * as fs from 'fs';

const FALLBACK_CLIENT_EMAIL = "firebase-adminsdk-fbsvc@edutrack-52e6c.iam.gserviceaccount.com";
const FALLBACK_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDgG6iBExrDnamv\nDC/H1okfjMmI0V6BO4VVOg16FzCZk7Glj/aRT8Udd1qb5uC+t5QTJaqNOlIYcUMS\nByn8su/Jrgw5vqag3AuliXscjPFV9sENWfdf3jwK70gRT9peYY7RFoTX5Sf2UhXa\nrW5nhEMzUWq0g76SuneHk5Uv1iKYCCPV3sAqUDh3QNOg7kHOm8C5CL1RsIgL9DVT\nqcxSgH8+TdHm3YznSEVPOFGCXHVuGpnC63lcWybnb9QXVDKc74e3LfO7joq3VoRs\naQjX7kbbMYwbxD6afj0++YgQhu3h7l4hrMGmBtGtWiJo9E6EmpnpfHHT0W8qP9NX\nuUUqtmWVAgMBAAECggEAJSKlebtHBxJxaKPgqFZAuJf6ro+K/70eK0YzBNUiOitC\nwkgoYmHRLEB3z4z4FteSqNg9T6j8q4zbwU6rQsgKezqPpLiWdzdJ6BnvlYaMAw5K\numylqh7IMkOo3H2FQM3HqEFOrVENSIAc8PR7bpnNt4uOiUT/Z47lzvMXQyr85oC7\nVNKa0VsoaySTXx6BCRk0SiYdMblRWcH5Fad2l3GBfWID+unaqFGTQ0Pv2sQO8U3E\noZZAUkqe728t6BqABaBPeRtkqeiDLFwfWcoXhGllRTyOGErTrWxJnsVVROEsxks3\n85xIVTgbHdT+TN4GL1paemWD1r+fi1TcMB0VhYWXLQKBgQD7Dc1dKigx1Zcnfaxw\nC81WQZMTfDTXPoxWJwKzxbx//rI8SUvVn83ARpoPm/wTJCIaue/o3U8rcxPMGWxQ\nuWhJzi15U9KKrcKKjgjsjffVS+mVpchMdqfhn8Ve/QgQZKc/42aZxgV2scV/uIRW\nF7qp93zhSxeXMMZD2OSO9k0evwKBgQDkhfQl/Ex5zesNlvtw6jEh5jC+Aj62URhg\nvjS6NAReszdBS32EBsORZ9ep8cnBoJIaPAOe8R7D0+RnTvMbtiY+FsLYx0YDVTXg\nqa+n5xb5gDbDEwZLmm+vwxduaprS2MA5l67EroerSoiODs9e+gkjzA+WyF8MJsoL\nN6wCSyAkqwKBgCXFWdRed1WoEOm8Gqlw3R/RFdOkqD6KBosfq2Rop4eKRj6TuHkX\nZdk7xgn7Kd2nXgovV0ztnu+mjJ/0Yztx6aLRBj5uwgpjQhWecPFGGrdYiHgfTRdT\n8sYbR5KW9xOgURlnmRQhmsjUziX9GMvrHgZcWcl7hr0UdX/XretkWw35AoGBAIql\wxVw161nA9+A5RkC3cBletktX4MZ/KJlhHQcrzINpc6V0JdTyz/jMvPG4NP7aelE\n1CWQwUuquX78ZX9Aqj8tbBY+APpwrnmaOhqymDvUUGVWm5EvJ+gJg6PYRgr6utW2\nc7Cc+28vj14xGhvTs8vmOOcQtqoWtqrLoi7aCax1AoGATDpt7bTuBc9CvAMqzAVJ\nDwP3SAx8eoF7dJRpV07mRqJNXbPSEFfbkcHdO87bcSAY2DK/70zcLo2SNa45XlVr\nBwLQun0Z4jThBwMZax9NYmExXJo2/85Sp/0xuGXsD5KduleUECuK62h0bduBSans\ni2IutY0GMcYygqgsRz4EnqM=\n-----END PRIVATE KEY-----\n`;

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
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || FALLBACK_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY || FALLBACK_PRIVATE_KEY;

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
    } else {
      this.logger.log(`Initializing Firebase Admin SDK with fallback service account credentials`);
      credential = cert({
        projectId,
        clientEmail,
        privateKey,
      });
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
