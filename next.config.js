/** @type {import('next').NextConfig} */
// FIX: When using `require` for an ES module that has a default export (like next-pwa),
// you need to access the `.default` property to get the function.
const withPWAInit = require("@ducanh2912/next-pwa").default;

const nextConfig = {
  // FIX: Sesuai dokumentasi Next.js, 'experimental.serverComponentsExternalPackages'
  // telah dipindahkan ke 'serverComponentsExternalPackages' di level atas (top-level).
  // Ini akan memberitahu Next.js untuk tidak mem-bundle library Prisma & PG di server,
  // yang akan menyelesaikan error 'Failed to load external module'.
  serverComponentsExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
  // Konfigurasi 'experimental.turbopack' juga dihapus karena tidak valid dan
  // menyebabkan warning.
};

// Cek apakah kita lagi jalanin di lokal (npm run dev)
const isDev = process.env.NODE_ENV === "development";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: false,
});

module.exports = isDev ? nextConfig : withPWA(nextConfig);