/** Konkurensi POS pada schema sementara; tidak menulis tabel production. */
import "dotenv/config";
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import pg from "pg";
const source = process.env.DATABASE_URL;
if (!/^postgres(ql)?:\/\//.test(source ?? "")) throw new Error("PostgreSQL diperlukan.");
const schema = `whs_pos_test_${randomUUID().replaceAll("-", "")}`;
const url = new URL(source); url.searchParams.set("schema", schema);
const db = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DIRECT_URL || source });
function worker(mode, input = {}) {
  return new Promise((resolve, reject) => {
    const child = fork("scripts/test-pos-postgres-worker.ts", [mode, JSON.stringify(input)], { execArgv: ["--import", "tsx"], env: { ...process.env, DATABASE_URL: url.href }, stdio: ["ignore", "ignore", "ignore", "ipc"] });
    let result;
    child.on("message", message => { result = message; });
    child.on("error", reject);
    child.on("exit", code => code === 0 && result?.ok ? resolve(result.data) : reject(new Error(result?.error ?? "Worker POS gagal")));
  });
}
let created = false;
try {
  await db.connect(); await db.query(`CREATE SCHEMA "${schema}"`); created = true;
  await db.query(`SET search_path TO "${schema}"`);
  for (const folder of readdirSync("prisma/postgresql/migrations").filter(name => /^\d/.test(name)).sort()) await db.query(readFileSync(`prisma/postgresql/migrations/${folder}/migration.sql`, "utf8"));
  const products = await worker("setup");
  console.log("Menguji 12 checkout bersamaan untuk stok 3 melalui 3 proses.");
  const results = (await Promise.all(Array.from({ length: 3 }, () => worker("sale", { productId: products.limited, count: 4 })))).flat();
  assert.equal(results.filter(row => row.status === 201).length, 3, JSON.stringify(results));
  assert.equal(results.filter(row => row.status === 409).length, 9);
  assert.equal(new Set(results.filter(row => row.status === 201).map(row => row.invoice)).size, 3);
  assert.equal((await db.query('SELECT stock FROM "PosProduct" WHERE id = $1', [products.limited])).rows[0].stock, 0);
  console.log("LULUS: tepat 3 penjualan, 9 penolakan stok habis, stok akhir 0.");
  const requestKey = randomUUID();
  const repeated = (await Promise.all(Array.from({ length: 4 }, () => worker("sale", { productId: products.repeat, requestKey, count: 1 })))).flat();
  assert(repeated.every(row => row.status === 201), JSON.stringify(repeated));
  assert.equal(new Set(repeated.map(row => row.id)).size, 1);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM "PosSale"')).rows[0].n, 4);
  assert.equal((await db.query('SELECT stock FROM "PosProduct" WHERE id = $1', [products.repeat])).rows[0].stock, 0);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM "PosStockMovement" WHERE "productId" = $1 AND kind = $2', [products.repeat, "SALE"])).rows[0].n, 1);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM "Ticket"')).rows[0].n, 0);
  console.log("LULUS: 4 pengiriman request sama menghasilkan 1 invoice dan 1 pengurangan stok; tabel tiket tetap kosong.");
  const imported = await worker("import-setup");
  const applied = await Promise.all(Array.from({ length: 4 }, () => worker("import-apply", { importId: imported.importId })));
  assert(applied.every(row => row.status === 200), JSON.stringify(applied));
  assert.equal((await db.query('SELECT stock FROM "PosProduct" WHERE id = $1', [imported.productId])).rows[0].stock, 15);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM "PosStockMovement" WHERE "productId" = $1 AND kind = $2', [imported.productId, "IMPORT"])).rows[0].n, 1);
  console.log("LULUS: 4 penyimpanan impor bersamaan menambah stok hanya sekali (10 menjadi 15).");
  const preview = await worker("import-preview");
  const [importResult, sales] = await Promise.all([
    worker("import-apply", { importId: preview.id }),
    worker("sale", { productId: imported.productId, count: 4 }),
  ]);
  assert(sales.every(row => row.status === 201), JSON.stringify(sales));
  assert([200, 409].includes(importResult.status), JSON.stringify(importResult));
  const finalStock = (await db.query('SELECT stock FROM "PosProduct" WHERE id = $1', [imported.productId])).rows[0].stock;
  assert.equal(finalStock, importResult.status === 200 ? 96 : 11);
  const ledger = await db.query('SELECT sum(quantity)::int AS total FROM "PosStockMovement" WHERE "productId" = $1', [imported.productId]);
  assert.equal(ledger.rows[0].total, finalStock);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM "Ticket"')).rows[0].n, 0);
  console.log(`LULUS: impor bersamaan dengan 4 checkout menjaga stok dan riwayat konsisten (stok ${finalStock}).`);
  console.log("Menguji kapasitas penuh: membuat lalu memperbarui 500 produk dalam satu file.");
  const bulk = await worker("import-large");
  assert.equal(bulk.count, 500);
  console.log(`LULUS: 500 produk dibuat (${bulk.createMs} ms) dan diperbarui (${bulk.updateMs} ms), stok masing-masing 2.`);
} finally {
  if (created) { await db.query('SET search_path TO public'); await db.query(`DROP SCHEMA "${schema}" CASCADE`); console.log("Schema uji POS dibersihkan; data production tidak diubah."); }
  await db.end();
}
