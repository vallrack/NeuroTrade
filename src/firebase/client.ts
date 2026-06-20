'use client';

import { initializeFirebase } from './index';

/**
 * Exportamos las instancias ya inicializadas desde el singleton central.
 * Esto garantiza que cualquier importación directa use las mismas instancias que el Provider.
 */
const instances = initializeFirebase();

export const app = instances.firebaseApp;
export const db = instances.firestore;
export const auth = instances.auth;
export const rtdb = instances.rtdb;
