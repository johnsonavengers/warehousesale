/**
 * Dijalankan di awal build Vercel (`npm run vercel-build`). Menghentikan
 * deploy dengan pesan jelas bila konfigurasi production belum lengkap,
 * daripada aplikasi ter-deploy tapi rusak saat dipakai.
 */
import { isPostgresSchemaInSync, OUT_OF_SYNC_MESSAGE } from "./postgres-schema.mjs";

const errors = [];
const warnings = [];

const dbUrl = process.env.DATABASE_URL ?? "";
if (!/^postgres(ql)?:\/\//.test(dbUrl)) {
  errors.push(
    "DATABASE_URL belum berisi database PostgreSQL (harus diawali postgres:// atau postgresql://).\n" +
      "  Di Vercel: tab Storage → buat/hubungkan database Neon ke project ini, lalu Redeploy.",
  );
}

const pw = process.env.ADMIN_PASSWORD ?? "";
if (!pw || pw === "ganti-password-ini") {
  errors.push(
    "ADMIN_PASSWORD belum di-set (atau masih contoh dari .env.example).\n" +
      "  Di Vercel: Settings → Environment Variables → tambahkan ADMIN_PASSWORD.",
  );
}

if (!process.env.NEXT_PUBLIC_BASE_URL) {
  warnings.push(
    "NEXT_PUBLIC_BASE_URL belum di-set; link tiket & tombol bagikan WhatsApp tidak akan berisi domain.\n" +
      "  Isi dengan URL aplikasi, mis. https://warehousesale.vercel.app, lalu Redeploy.",
  );
}

if (!isPostgresSchemaInSync()) errors.push(OUT_OF_SYNC_MESSAGE);

for (const w of warnings) console.warn(`PERINGATAN: ${w}`);
if (errors.length > 0) {
  for (const e of errors) console.error(`ERROR: ${e}`);
  process.exit(1);
}
console.log("Konfigurasi deploy OK.");
