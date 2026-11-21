import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Adapter dipilih dari DATABASE_URL:
 *  - "file:..."        → SQLite (development)
 *  - "postgres(ql)://" → PostgreSQL (production)
 */
function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const adapter = /^postgres(ql)?:\/\//.test(url)
    ? new PrismaPg({ connectionString: url }, { schema: new URL(url).searchParams.get("schema") ?? undefined })
    : new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type Db = PrismaClient;
