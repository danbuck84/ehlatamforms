import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

export const ALLOWED_ADMIN_EMAILS = (
  (import.meta.env.VITE_ADMIN_EMAILS as string | undefined) ?? 'daniel.buck@rocketseat.team'
)
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export function getClientFirebase(): { app: FirebaseApp; auth: Auth; db: Firestore } {
  if (!appInstance) {
    const existing = getApps()[0];
    appInstance =
      existing ??
      initializeApp({
        apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string | undefined) ?? 'demo-api-key',
        authDomain:
          (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined) ??
          'demo-englishtalk.firebaseapp.com',
        projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined) ?? 'demo-englishtalk',
        appId: (import.meta.env.VITE_FIREBASE_APP_ID as string | undefined) ?? '1:000000:web:demo',
      });
  }
  const useEmulator =
    import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true' ||
    (!import.meta.env.VITE_FIREBASE_API_KEY &&
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));

  if (!authInstance) {
    authInstance = getAuth(appInstance);
    if (useEmulator) {
      connectAuthEmulator(authInstance, 'http://127.0.0.1:9099', { disableWarnings: true });
    }
  }
  if (!dbInstance) {
    dbInstance = getFirestore(appInstance);
    if (useEmulator) {
      connectFirestoreEmulator(dbInstance, '127.0.0.1', 8080);
    }
  }
  return { app: appInstance, auth: authInstance, db: dbInstance };
}
