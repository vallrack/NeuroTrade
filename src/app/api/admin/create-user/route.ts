import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Inicializa Firebase Admin (solo en el servidor)
function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { email, password, displayName, role } = await req.json();

    if (!email || !password || !displayName) {
      return NextResponse.json({ error: 'Faltan campos obligatorios.' }, { status: 400 });
    }

    const app = getAdminApp();
    const auth = getAuth(app);
    const db = getFirestore(app);

    // Crear usuario en Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName,
    });

    // Crear perfil en Firestore con rol asignado
    await db.collection('users').doc(userRecord.uid).set({
      email,
      displayName,
      role: role || 'operator',
      disabled: false,
      createdAt: new Date().toISOString(),
      createdByAdmin: true,
    });

    return NextResponse.json({ uid: userRecord.uid, success: true });
  } catch (err: any) {
    console.error('[ADMIN CREATE USER]', err);
    return NextResponse.json({ error: err.message || 'Error interno.' }, { status: 500 });
  }
}
