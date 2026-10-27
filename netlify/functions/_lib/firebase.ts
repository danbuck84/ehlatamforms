import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getAppCheck, type AppCheck } from 'firebase-admin/app-check';
import { env } from './env';

let app: App | null = null;

/** Lazily initialised Admin SDK (one instance per warm function container). */
export function adminApp(): App {
  if (app) return app;
  const existing = getApps()[0];
  if (existing) {
    app = existing;
    return app;
  }
  const projectId = env('FIREBASE_PROJECT_ID') ?? env('GCLOUD_PROJECT') ?? 'demo-englishtalk';
  const usingEmulator = Boolean(env('FIRESTORE_EMULATOR_HOST'));
  const clientEmail = env('FIREBASE_CLIENT_EMAIL');
  const privateKey = env('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
  if (usingEmulator || !clientEmail || !privateKey) {
    app = initializeApp({ projectId });
  } else {
    app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
  }
  return app;
}

let firestore: Firestore | null = null;
export function db(): Firestore {
  if (!firestore) {
    firestore = getFirestore(adminApp());
    firestore.settings({ ignoreUndefinedProperties: true });
  }
  return firestore;
}

export function adminAuth(): Auth {
  return getAuth(adminApp());
}

export function appCheck(): AppCheck {
  return getAppCheck(adminApp());
}
