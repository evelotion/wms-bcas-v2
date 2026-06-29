import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    // Di versi 7, kalau pake config file, kita nggak perlu masukin url lagi di sini
    // karena udah di-handle otomatis lewat prisma.config.ts
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;