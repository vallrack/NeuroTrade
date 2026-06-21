
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Nota: En Vercel usaremos las variables de entorno para inicializar sin archivo físico
const firebaseAdminConfig = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  // Para operaciones simples de servidor, a veces basta con el ID si el entorno tiene permisos
};

export function getAdminDb() {
  if (!getApps().length) {
    initializeApp({
      projectId: firebaseAdminConfig.projectId,
    });
  }
  return getFirestore();
}
