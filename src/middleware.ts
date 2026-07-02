import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('wms_session')?.value;
  const isLoginPage = request.nextUrl.pathname.startsWith('/login');
  const path = request.nextUrl.pathname;

  // 1. Belum login, tapi mau akses halaman dalam
  if (!sessionCookie && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 2. Udah login, tapi mau akses halaman login
  if (sessionCookie && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 3. ROLE-BASED PROTECTION (Mencegah akses silang)
  if (sessionCookie) {
    try {
      const session = JSON.parse(sessionCookie);
      
      // ADMIN tidak boleh akses Inbound dan Outstanding
      if (session.role === "ADMIN" && (path.startsWith('/inbound') || path.startsWith('/outstanding'))) {
        return NextResponse.redirect(new URL('/', request.url));
      }
      
      // GUDANG tidak boleh akses Laporan (Opsional, bisa lo sesuaikan)
      if (session.role === "GUDANG" && path.startsWith('/laporan')) {
        return NextResponse.redirect(new URL('/', request.url));
      }
    } catch (error) {
      console.error("Session parse error di middleware");
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg).*)',
  ],
};