import { PrismaClient } from '@local-prisma/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Lazily-created Prisma singleton (same adapter-pg wiring the seed uses). Created
 * on first use — i.e. at request time, not at import time — so that
 * `dotenv.config()` in index.ts has already populated `DATABASE_URL` by the time
 * we read it. (Imports are hoisted above that call, so eager creation here would
 * read an undefined connection string.)
 */
let client: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (!client) {
    client = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
  }
  return client;
}
