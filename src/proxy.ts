// src/proxy.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // Ambil tiket/cookie sesi dari browser
  const session = request.cookies.get('wms_session');
  
  // Cek apakah user sedang mencoba buka halaman login
  const isLoginPage = request.nextUrl.pathname.startsWith('/login');

  // Kalau belum login dan mencoba buka halaman selain login -> tendang ke login
  if (!session && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Kalau sudah login tapi iseng buka halaman login lagi -> kembalikan ke dashboard
  if (session && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

// Tentukan halaman mana saja yang dilindungi oleh middleware ini
export const config = {
  matcher: [
    // Lindungi semua rute, KECUALI file statis, API Next.js, dan gambar
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg).*)',
  ],
};