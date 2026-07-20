import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Secret key harus SAMA PERSIS dengan yang ada di actions.ts
const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "wms-bcas-super-secret-key-yang-susah-ditebak"
);

export async function middleware(request: NextRequest) {
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

  // 3. ROLE-BASED PROTECTION (Udah Aman Pakai JWT)
  if (sessionCookie) {
    try {
      // Decode JWT dengan aman, bakal error kalau token dimanipulasi
      const { payload } = await jwtVerify(sessionCookie, SECRET_KEY);
      
      // ADMIN (Staf) tidak boleh akses Inbound (khusus Admin Gudang)
      if (payload.role === "ADMIN" && path.startsWith('/inbound')) {
        return NextResponse.redirect(new URL('/', request.url));
      }
      
      // GUDANG tidak boleh akses Laporan
      if (payload.role === "GUDANG" && path.startsWith('/laporan')) {
        return NextResponse.redirect(new URL('/', request.url));
      }
    } catch (error) {
      console.error("JWT Verification Failed di middleware");
      // Kalau user iseng ngubah isi cookie, buang cookie-nya terus tendang ke login!
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('wms_session');
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg).*)',
  ],
};