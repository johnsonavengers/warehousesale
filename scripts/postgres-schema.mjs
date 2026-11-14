/**
 * Membuat prisma/postgresql/schema.prisma dari prisma/schema.prisma.
 *
 * prisma/schema.prisma (SQLite, untuk development & test) tetap satu-satunya
 * sumber kebenaran. Versi PostgreSQL (production) hanya berbeda di provider
 * dan path output client, jadi file itu dibuat dari sini, bukan diedit manual.
 *
 *   node scripts/postgres-schema.mjs          → tulis ulang file PostgreSQL
 *   node scripts/postgres-schema.mjs --check  → gagal bila file belum sinkron
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SOURCE = path.join(root, "prisma/schema.prisma");
export const TARGET = path.join(root, "prisma/postgresql/schema.prisma");

const HEADER = [
  "// FILE INI DIBUAT OTOMATIS dari prisma/schema.prisma. JANGAN DIEDIT LANGSUNG.",
  "// Ubah prisma/schema.prisma, lalu jalankan: npm run db:pg-schema",
  "",
].join("\n");

const REPLACEMENTS = [
  ['provider = "sqlite"', 'provider = "postgresql"'],
  ['"../src/generated/prisma"', '"../../src/generated/prisma"'],
];

export function toPostgres(sqliteSchema) {
  let out = sqliteSchema;
  for (const [from, to] of REPLACEMENTS) {
    if (!out.includes(from)) {
      throw new Error(`prisma/schema.prisma tidak berisi ${from}; perbarui scripts/postgres-schema.mjs`);
    }
    out = out.split(from).join(to);
  }
  return HEADER + out;
}

const normalize = (s) => s.replace(/\r\n/g, "\n").trimEnd();

/** true bila prisma/postgresql/schema.prisma sesuai dengan prisma/schema.prisma. */
export function isPostgresSchemaInSync() {
  if (!fs.existsSync(TARGET)) return false;
  const expected = toPostgres(fs.readFileSync(SOURCE, "utf8"));
  return normalize(fs.readFileSync(TARGET, "utf8")) === normalize(expected);
}

export const OUT_OF_SYNC_MESSAGE =
  "prisma/postgresql/schema.prisma belum sinkron dengan prisma/schema.prisma.\n" +
  "Jalankan `npm run db:pg-schema`, buat migrasi PostgreSQL baru (lihat README), lalu commit keduanya.";

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.includes("--check")) {
    if (!isPostgresSchemaInSync()) {
      console.error(OUT_OF_SYNC_MESSAGE);
      process.exit(1);
    }
    console.log("Schema PostgreSQL sinkron.");
  } else {
    fs.mkdirSync(path.dirname(TARGET), { recursive: true });
    fs.writeFileSync(TARGET, toPostgres(fs.readFileSync(SOURCE, "utf8")));
    console.log(`Ditulis: ${path.relative(root, TARGET)}`);
  }
}
