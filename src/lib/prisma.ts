// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function getConnectionString(): string {
  // Prioritas: DATABASE_URL > SUPABASE_DB_URL
  const url = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (url) return url;

  // Fallback untuk development tanpa database (akan error saat runtime)
  console.warn('Warning: DATABASE_URL and SUPABASE_DB_URL not found. Database operations will fail.');
  return 'postgresql://dummy:dummy@localhost:5432/dummy';
}

const connectionString = getConnectionString();

// Setup Pool untuk koneksi database
const pool = new Pool({
  connectionString,
  // Tambahkan config untuk connection stability
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const adapter = new PrismaPg(pool);

let prisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({ adapter });
} else {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  prisma = globalForPrisma.prisma;
}

export default prisma;
