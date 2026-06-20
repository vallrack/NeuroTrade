
'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getDatabase, Database } from 'firebase/database';
import { firebaseConfig } from './config';

let app: FirebaseApp;
let firestore: Firestore;
let auth: Auth;
let rtdb: Database;

/**
 * Inicializa Firebase garantizando que sea una instancia única (Singleton)
 * para evitar errores de "Unexpected state" en Firestore.
 */
export function initializeFirebase(): {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  rtdb: Database;
} {
  if (getApps().length > 0) {
    app = getApp();
  } else {
    app = initializeApp(firebaseConfig);
  }
  
  // Solo inicializamos los servicios si no existen para evitar duplicados
  if (!firestore) firestore = getFirestore(app);
  if (!auth) auth = getAuth(app);
  if (!rtdb) rtdb = getDatabase(app);

  return { firebaseApp: app, firestore, auth, rtdb };
}

// Exportamos las instancias para uso directo
export const getFirebase = () => {
  const instances = initializeFirebase();
  return { 
    app: instances.firebaseApp, 
    db: instances.firestore, 
    auth: instances.auth, 
    rtdb: instances.rtdb 
  };
};

export * from './provider';
export * from './auth/use-user';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
