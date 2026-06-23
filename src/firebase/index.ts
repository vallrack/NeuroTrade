'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, terminate, initializeFirestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getDatabase, Database } from 'firebase/database';
import { firebaseConfig } from './config';

/**
 * PROTOCOLO DE INSTANCIA ÚNICA V7
 * Evita el error "Unexpected state" asegurando que solo exista 
 * un túnel activo por sesión de navegador.
 */
let cachedApp: FirebaseApp | null = null;
let cachedFirestore: Firestore | null = null;
let cachedAuth: Auth | null = null;
let cachedRTDB: Database | null = null;

export function initializeFirebase() {
  if (typeof window === 'undefined') return {} as any;

  if (!cachedApp) {
    cachedApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    
    try {
      cachedFirestore = initializeFirestore(cachedApp, {
        experimentalForceLongPolling: true
      });
    } catch {
      cachedFirestore = getFirestore(cachedApp);
    }
    
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

// Exportamos los servicios directamente para uso simplificado
export const db = () => initializeFirebase().firestore;
export const auth = () => initializeFirebase().auth;

export * from './provider';
export * from './auth/use-user';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
