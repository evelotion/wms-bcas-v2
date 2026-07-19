/** @type {import('next').NextConfig} */
// FIX: When using `require` for an ES module that has a default export (like next-pwa),
// you need to access the `.default` property to get the function.
const withPWAInit = require("@ducanh2912/next-pwa").default;

const nextConfig = {
  // FIX: di Next.js 14, serverComponentsExternalPackages harus di dalam experimental
  experimental: {
    serverComponentsExternalPackages: [
      "@prisma/client",
      "@prisma/adapter-neon", 
      "@neondatabase/serverless", 
      "ws",
      "bufferutil",
      "utf-8-validate"
    ],
  },
}; // <-- Nah, tutup kurung kurawal sama titik komanya kurang di sini bro

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