
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

  // 2. Si ya hay sesión y el usuario intenta ir al login, lo mandamos al dashboard
  if (session && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 3. Protección de rutas privadas
  if (!isPublicPath && !session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
