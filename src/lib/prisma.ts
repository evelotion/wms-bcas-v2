import { PrismaClient } from '@prisma/client';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function getConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn('Warning: DATABASE_URL not found. Database operations will fail.');
    return 'postgresql://dummy:dummy@localhost:5432/dummy';
  }
  return url;
}

const connectionString = getConnectionString();
const pool = new Pool({ connectionString });
const adapter = new PrismaNeon(pool);

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