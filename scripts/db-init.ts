/**
 * Membuat ulang database SQLite dari file migrasi TANPA Prisma CLI.
 * Dipakai oleh test (Vitest/Playwright) dan berguna di lingkungan offline.
 * Untuk pemakaian normal gunakan `npx prisma migrate deploy`.
 *
 *   tsx scripts/db-init.ts            → memakai DATABASE_URL
 *   tsx scripts/db-init.ts --reset    → hapus file DB dulu
 */
import "dotenv/config";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export function sqlitePathFromUrl(url: string): string {
  if (!url.startsWith("file:")) throw new Error("db-init hanya untuk SQLite (DATABASE_URL=file:...)");
  return path.resolve(process.cwd(), url.slice("file:".length).split("?")[0]);
}

export function initSqliteDb(url: string, opts: { reset?: boolean } = {}): string {
  const file = sqlitePathFromUrl(url);
  if (opts.reset) {
    for (const f of [file, `${file}-journal`, `${file}-wal`, `${file}-shm`]) {
      if (fs.existsSync(f)) fs.rmSync(f);
    }
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  const hasTables = db
    .prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name='EventDay'")
    .get() as { n: number };
  if (hasTables.n === 0) {
    const dir = path.resolve(process.cwd(), "prisma/migrations");
    const migrations = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    for (const m of migrations) {
      db.exec(fs.readFileSync(path.join(dir, m, "migration.sql"), "utf8"));
    }
  }
  db.close();
  return file;
}

if (process.argv[1] && /db-init\.(ts|js|mjs)$/.test(process.argv[1])) {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const file = initSqliteDb(url, { reset: process.argv.includes("--reset") });
  console.log(`Database siap: ${file}`);
}
