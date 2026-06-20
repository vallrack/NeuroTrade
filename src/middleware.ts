
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('session');
  const { pathname } = request.nextUrl;

  // Rutas que no requieren autenticación
  if (
    pathname === '/login' || 
    pathname.startsWith('/_next') || 
    pathname.startsWith('/api/') ||
    pathname.includes('.') // Archivos estáticos
  ) {
    return NextResponse.next();
  }

  // Redirigir al login si no hay sesión
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    // Preservar la URL a la que intentaba acceder el operador
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Coincidir con todas las rutas excepto las de sistema
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
