
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/request';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('session');
  const { pathname } = request.nextUrl;

  // 1. Rutas públicas que no requieren sesión
  const isPublicPath = 
    pathname === '/login' || 
    pathname.startsWith('/_next') || 
    pathname.startsWith('/api/') ||
    pathname.includes('.');

  if (isPublicPath) {
    return NextResponse.next();
  }

  // 2. Si no hay sesión y la ruta es privada, redirigir al login
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Permitir el paso si hay sesión
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
