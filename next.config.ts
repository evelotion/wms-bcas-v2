import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

<<<<<<< HEAD
const nextConfig: NextConfig = {
  // FIX: Sesuai warning dari Next.js, 'experimental.serverComponentsExternalPackages'
  // telah dipindahkan ke 'serverComponentsExternalPackages' di level atas (top-level).
  // Ini akan memberitahu Next.js untuk tidak mem-bundle library Prisma & PG di server,
  // yang akan menyelesaikan error 'Failed to load external module'.
  serverComponentsExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
  // Konfigurasi 'experimental.turbopack' juga dihapus karena tidak valid dan
  // menyebabkan warning.
=======
const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig = {
  // Pastikan tidak ada 'output: export' di sini
  turbopack: {},
>>>>>>> 23bb1bf36ee2eccc18768a8143ec1991a9afd5d9
};

// Cek apakah kita lagi jalanin di lokal (npm run dev)
const isDev = process.env.NODE_ENV === "development";

// Kalau lagi di lokal (isDev), jangan bungkus pakai PWA biar Turbopack nggak error.
// Kalau lagi di-build (Vercel), bungkus pakai PWA.
export default isDev 
  ? nextConfig 
  : withPWAInit({
      dest: "public",
      cacheOnFrontEndNav: true,
      aggressiveFrontEndNavCaching: true,
      reloadOnOnline: true,
      disable: false, // Nggak perlu pengecekan disable di sini karena udah di-bypass di atas
    })(nextConfig);