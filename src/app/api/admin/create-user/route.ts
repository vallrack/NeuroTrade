import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { email, password, displayName, role } = await req.json();

    if (!email || !password || !displayName) {
      return NextResponse.json({ error: 'Faltan campos obligatorios.' }, { status: 400 });
    }

    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Falta la API KEY de Firebase.' }, { status: 500 });
    }

    // Usar la REST API pública de Firebase para evitar la necesidad de llaves de Firebase Admin
    const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true
      })
    });

    const authData = await authRes.json();

    if (!authRes.ok) {
      return NextResponse.json({ error: authData.error?.message || 'Error al crear el usuario en Auth' }, { status: 400 });
    }

    // Devolvemos el UID al cliente, para que el cliente (que es SuperAdmin)
    // escriba el documento en Firestore con sus propios permisos.
    return NextResponse.json({ uid: authData.localId, success: true });
  } catch (err: any) {
    console.error('[ADMIN CREATE USER]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
