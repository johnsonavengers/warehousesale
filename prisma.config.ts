import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Schema & folder migrasi dipilih dari DATABASE_URL:
 *  - "file:..."        → SQLite     (prisma/schema.prisma, prisma/migrations)
 *  - "postgres(ql)://" → PostgreSQL (prisma/postgresql/..., untuk production)
 */
const url = process.env.DATABASE_URL ?? "file:./dev.db";
const isPostgres = /^postgres(ql)?:\/\//.test(url);
const seed = "tsx prisma/seed.ts";

export default defineConfig(
  isPostgres
    ? {
        schema: "prisma/postgresql/schema.prisma",
        migrations: { path: "prisma/postgresql/migrations", seed },
        // Migrasi butuh koneksi langsung (bukan pooled) bila tersedia.
        // Integrasi Neon di Vercel otomatis mengisi DATABASE_URL_UNPOOLED.
        datasource: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DIRECT_URL ?? url },
      }
    : {
        schema: "prisma/schema.prisma",
        migrations: { path: "prisma/migrations", seed },
        datasource: { url },
      },
);
