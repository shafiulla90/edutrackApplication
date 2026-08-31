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
        const DEFAULT_SA = {
          projectId: 'edutrack-52e6c',
          clientEmail: 'firebase-adminsdk-fbsvc@edutrack-52e6c.iam.gserviceaccount.com',
          privateKey: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCvdwWa1t8LAuLS\nl8IQcE5A/4vGvFsgpGSOD/E+iadHQASUYSgaiacWS9MAykswvwBbgtzbJjjAx/E3\nQ/Tr9ZGUa+kfyTtu/lTur8CBICJ959Yq9fXTHjn7NmkREN4Ump4pqbQqWAREgJxr\nk5KgCy/TlBWBgT0uKm6n8GiCFYgNE/HlHV26XQBeUIdBluNPCglmEeTccJUhnmzC\nEOlwzxXYCE/EJi5IhGQKKW9bXQTbnsWwmvJCNmzTBJxlhe2VCdFwo0jIMtVJx7IW\nwj0EXBGRFzl9MXs2Li1Ky9xqn8DCk3DoSJOhsXI7KG/KdU8Jix6acxsB13jwPgQ3\n390RBWa3AgMBAAECggEAQw8zBi1uyw+MTr4PPicd0TuZWRftn/kUMTMomSUU2GdA\nGNFU+Wd4g03xU5D80aF96nuGGv9tm0gPCXcgaPnObLIdQ7etzkrHfP2QjgkRBZuQ\nP5UHIWug70CpQQt4RNme7v9byv8eimu43GhnFmGQIsWqvnb9QeKXrfl0h5rhB1Xg\nrlvYDVuJ6dgctGuyLIs8y+QI599Vu7xVPH8jmFUsFAGoKOKqm2xL8d63XTY2IQpv\ni7G+qiTTusJyU2VigFTyxiYoYdVUQeVycKgo1jkI86gy8Ds50MZ025HA726BtD2i\nV+XIJb0bSaQUAWSH9HMNY+hrafEY91qi2JTAFuvJmQKBgQDjHPct3w9dyKNltnOc\nzRffzl+g7QHZd0Wvfg6vHOHi3JarF1jMZ7g2RsOYo8XAUdapzK+udK6yD0zHl/8l\n/ItbhNDNv+MoI/F4tIoZxKQx/9t9IcwZs9suZ9S2elPGoUZudj4jVsks/fFzI/rO\nXR3HjIMKjQVoKtnO4oJ7BY9ViwKBgQDFyFaG7Or4mVCLqRSiF/ZhUz/dv7LzW5Wn\nzcK3Bt09hJwML4HoMuG1z3jWN5HWRhgHjLO7Ti81aG840Jh+S4wdUPKEb4itP2mI\na4D8hLhXeHJHK9uDIqzhiD/s3Sixi24T+plyiS4RZEPBnDi6c6vHzOJn8UtWCF9P\nfxcT2++RBQKBgD1ry/1/4ev/IxGS8llprhc8/OfMsT9a3mHDubzqFrz/40+KFN3S\n/yLOqH9Ta1vDxkZNsQWBUO2e7ajdFofzcMzjcoTybECi199JFEA7yhwrkfSZe1VI\nKvK16fUfyCBj5WRiXhO4mNeuJep5xI6i6DbbbWUhFmFBlX46DAexTT5ZAoGBAJA/\nmwvxAzao6tvRR2EpROKayvu58pQW+cFXCmpesUFK1Fz20TI+2eu2E5V5Ff5HRQNM\nlVFIppm3P1cam/2Qr/I5tYbtqathkmCSt5J0YdY53G8YB5NO2PPsYWMpsaI75N7h\naMTmVBkPHXO5so4aCvE/9uiETcPDe3AJaxVq1QDZAoGBAKZDGVfTadpAsKaFCG5o\nB+r2nkvtppQONrgtAXsBZe4ZQEJ+9AtVy060BgxcDHHM+qRTk4ewoID6umPVxpAZ\nzkn8wYoXIeDcCGh/lsTcITVvGu/XJmyJej9ivGB3IQGTz/CyHl4hdloWWauftp40\nAV4he2uP1LlTVHUUd/yxzNWK\n-----END PRIVATE KEY-----\n",
        };
        this.logger.log(`Initializing Firebase Admin SDK using embedded fallback service account`);
        credential = cert(DEFAULT_SA);
      } catch (e) {
        this.logger.error('Failed to initialize embedded service account fallback', e);
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
