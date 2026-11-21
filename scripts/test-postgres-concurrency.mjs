/** PostgreSQL nyata, schema sementara: tidak menulis tabel aplikasi publik. */
import "dotenv/config";
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import pg from "pg";

const source = process.env.DATABASE_URL;
if (!/^postgres(ql)?:\/\//.test(source ?? "")) throw new Error("DATABASE_URL PostgreSQL diperlukan.");
const schema = `whs_test_${randomUUID().replaceAll("-", "")}`;
const testUrl = new URL(source);
testUrl.searchParams.set("schema", schema);
const env = { ...process.env, DATABASE_URL: testUrl.href, TEST_NOW: "2026-11-20T09:00:00+07:00" };
const db = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DIRECT_URL || source });

function worker(mode, phones = []) {
  return new Promise((resolve, reject) => {
    const child = fork("scripts/test-postgres-worker.ts", [mode, JSON.stringify(phones)], {
      execArgv: ["--import", "tsx"], env, stdio: ["ignore", "ignore", "ignore", "ipc"],
    });
    let result;
    child.on("message", (message) => { result = message; });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 && result?.ok ? resolve(result.data) : reject(new Error(result?.error ?? `Worker gagal (${code})`)));
  });
}
let created = false;
try {
  await db.connect();
  await db.query(`CREATE SCHEMA "${schema}"`);
  created = true;
  await db.query(`SET search_path TO "${schema}"`);
  for (const dir of readdirSync("prisma/postgresql/migrations").filter((name) => /^\d/.test(name)).sort()) {
    await db.query(readFileSync(`prisma/postgresql/migrations/${dir}/migration.sql`, "utf8"));
  }
  console.log("Schema pengujian terisolasi siap; menyiapkan jadwal.");
  await worker("seed");
  console.log("Menguji 32 pemesan bersamaan melalui 4 proses terpisah.");
  const groups = await Promise.all(Array.from({ length: 4 }, (_, group) =>
    worker("book", Array.from({ length: 8 }, (_, i) => `08129999${String(group * 8 + i).padStart(4, "0")}`))));
  const tickets = groups.flat();
  assert.equal(tickets.length, 32);
  assert(tickets.every((t) => t.status === 201));
  assert.equal(new Set(tickets.map((t) => t.number)).size, 32);
  assert(tickets.every((t) => Number.isInteger(t.number) && t.number >= 1 && t.number <= 300));
  assert.equal(new Set(tickets.map((t) => t.code)).size, 32);
  assert(tickets.every((t) => t.session === Math.floor((t.number - 1) / 50) + 1));
  console.log("LULUS: 32 nomor acak unik, seluruh nomor sesuai rentang sesinya.");
  const duplicates = (await Promise.all(Array.from({ length: 4 }, () => worker("book", ["081288887777"])))).flat();
  assert.equal(duplicates.filter((t) => t.status === 201).length, 1);
  assert.equal(duplicates.filter((t) => t.status === 409).length, 3);
  const counts = await db.query('SELECT count(*)::int AS count, count(DISTINCT (date, "queueNumber"))::int AS unique FROM "Ticket"');
  assert.deepEqual(counts.rows[0], { count: 33, unique: 33 });
  console.log("LULUS: 4 request WhatsApp sama menghasilkan tepat 1 tiket. Total 33 tiket tanpa nomor ganda.");
} finally {
  if (created) {
    await db.query('SET search_path TO public');
    // Nama ini hanya dibuat di atas, tidak pernah diambil dari input pengguna.
    await db.query(`DROP SCHEMA "${schema}" CASCADE`);
    console.log("Schema pengujian dibersihkan; data publik tidak disentuh.");
  }
  await db.end();
}
