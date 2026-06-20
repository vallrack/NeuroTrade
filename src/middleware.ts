
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/request';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('session');
  const { pathname } = request.nextUrl;

  // 1. Rutas públicas y recursos estáticos
  const isPublicPath = 
    pathname === '/login' || 
    pathname.startsWith('/_next') || 
    pathname.startsWith('/api/') ||
    pathname.includes('.');

  if (isPublicPath) {
    return NextResponse.next();
  }

  // 2. Protección de rutas privadas
  // Si no hay cookie de sesión, redirigimos al login
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    // Solo añadimos el redirect si no estamos ya en una redirección
    if (!pathname.startsWith('/login')) {
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 3. Permitir el paso si hay sesión o es una ruta permitida
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
