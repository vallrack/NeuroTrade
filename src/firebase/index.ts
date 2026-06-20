'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getDatabase, Database } from 'firebase/database';
import { firebaseConfig } from './config';

/**
 * Variable global para cachear las instancias y evitar inicializaciones múltiples
 * que causan el error "Unexpected state" en Firestore.
 */
let cachedInstances: {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  rtdb: Database;
} | null = null;

export function initializeFirebase() {
  if (cachedInstances) {
    return cachedInstances;
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  
  // Inicializamos los servicios una sola vez por el ciclo de vida de la aplicación
  const firestore = getFirestore(app);
  const auth = getAuth(app);
  const rtdb = getDatabase(app);

  cachedInstances = {
    firebaseApp: app,
    firestore,
    auth,
    rtdb,
  };

  return cachedInstances;
}

// Exportamos los hooks y utilidades
export * from './provider';
export * from './auth/use-user';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
