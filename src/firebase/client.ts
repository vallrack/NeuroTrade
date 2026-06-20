
'use client';

import { initializeFirebase } from './index';

/**
 * Redirigimos todas las exportaciones al archivo central index.ts 
 * para evitar inicializaciones duplicadas que causan fallos de estado.
 */
const { firebaseApp, firestore, auth, rtdb } = initializeFirebase();

export { 
  firebaseApp as app, 
  firestore as db, 
  auth, 
  rtdb 
};
