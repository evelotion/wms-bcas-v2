import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('wms_session');
  const isLoginPage = request.nextUrl.pathname.startsWith('/login');

  if (!session && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (session && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg).*)',
  ],
};
