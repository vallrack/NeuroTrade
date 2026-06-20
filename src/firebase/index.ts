
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
  
  firestore = getFirestore(app);
  auth = getAuth(app);
  rtdb = getDatabase(app);

  return { firebaseApp: app, firestore, auth, rtdb };
}

// Exportamos las instancias para uso directo en componentes y acciones
export const getFirebase = () => {
  if (!app) initializeFirebase();
  return { app, db: firestore, auth, rtdb };
};

export * from './provider';
export * from './auth/use-user';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
