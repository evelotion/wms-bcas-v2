import { defineConfig } from 'prisma';

export default defineConfig({
  datasource: {
    provider: 'postgresql',
    url: process.env.DATABASE_URL, // Prisma sekarang ambil URL dari sini
  },
});