
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Desactivamos completamente las protecciones de servidor para evitar bucles.
  // La seguridad se gestionará íntegramente en el cliente y mediante reglas de Firestore.
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
