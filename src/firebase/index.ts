'use client';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, initializeFirestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getDatabase, Database } from 'firebase/database';
import { firebaseConfig } from './config';

let cachedApp: FirebaseApp | null = null;
let cachedFirestore: Firestore | null = null;
let cachedAuth: Auth | null = null;
let cachedRTDB: Database | null = null;

export function initializeFirebase() {
  if (typeof window === 'undefined') return {} as any;

  if (!cachedApp) {
    cachedApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

    cachedFirestore = initializeFirestore(cachedApp, {
      experimentalAutoDetectLongPolling: true,
    });

    cachedAuth = getAuth(cachedApp);
    cachedRTDB = getDatabase(cachedApp);
  }

  return {
    firebaseApp: cachedApp!,
    firestore: cachedFirestore!,
    auth: cachedAuth!,
    rtdb: cachedRTDB!,
  };
}

export const db = () => initializeFirebase().firestore;
export const auth = () => initializeFirebase().auth;
export * from './provider';
export * from './auth/use-user';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
