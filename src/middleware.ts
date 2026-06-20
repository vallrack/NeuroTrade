
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/request';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('session');
  const { pathname } = request.nextUrl;

  // Permitir siempre el acceso a login, recursos estáticos y APIs
  if (
    pathname === '/login' || 
    pathname.startsWith('/_next') || 
    pathname.startsWith('/api/') ||
    pathname.includes('.')
  ) {
    // Si ya hay sesión y quiere ir al login, mandarlo al dashboard
    if (session && pathname === '/login') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // Si no hay sesión y trata de acceder al dashboard o raíz, mandarlo al login
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('from', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
