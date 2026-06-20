
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/request';

export function middleware(request: NextRequest) {
  // Desactivamos las redirecciones de middleware para evitar bucles infinitos con las cookies.
  // La protección se manejará en el lado del cliente dentro de las páginas/layouts protegidos.
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
