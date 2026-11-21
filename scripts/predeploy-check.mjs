/**
 * Dijalankan di awal build Vercel (`npm run vercel-build`). Menghentikan
 * deploy dengan pesan jelas bila konfigurasi production belum lengkap,
 * daripada aplikasi ter-deploy tapi rusak saat dipakai.
 */
import { isPostgresSchemaInSync, OUT_OF_SYNC_MESSAGE } from "./postgres-schema.mjs";
import { z } from "zod";

const errors = [];
const target = process.env.VERCEL_ENV === "preview" ? "Preview" : "Production";
const settings = `Vercel → project → Settings → Environment Variables (${target})`;

function isPostgresUrl(value) {
  // Sama dengan pemilihan provider/adapter pada prisma.config.ts dan src/lib/prisma.ts.
  if (!/^postgres(ql)?:\/\//.test(value)) return false;
  try {
    const url = new URL(value);
    return /^postgres(ql)?:$/.test(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
}

// Memudahkan pengecekan apakah deploy sudah memakai commit yang terbaru.
const revision = process.env.VERCEL_GIT_COMMIT_SHA;
if (revision) console.log(`Memeriksa konfigurasi ${target}, commit ${revision.slice(0, 7)}.`);

const dbUrl = process.env.DATABASE_URL ?? "";
if (!dbUrl.trim()) {
  errors.push(
    "DATABASE_URL belum tersedia untuk deployment ini.\n" +
      "  Buka Storage pada project Vercel, hubungkan PostgreSQL (mis. Neon), lalu pastikan\n" +
      `  DATABASE_URL tersedia di ${settings}.`,
  );
} else if (!isPostgresUrl(dbUrl)) {
  errors.push(
    "DATABASE_URL harus berupa URL koneksi PostgreSQL yang valid (postgres:// atau postgresql://).\n" +
      "  file:./dev.db hanya untuk komputer lokal dan tidak bisa dipakai di Vercel.\n" +
      `  Isi URL koneksi dari penyedia database di ${settings}.`,
  );
}

// Harus sama dengan urutan pilihan koneksi migrasi di prisma.config.ts.
const directKey = process.env.DATABASE_URL_UNPOOLED !== undefined
  ? "DATABASE_URL_UNPOOLED"
  : process.env.DIRECT_URL !== undefined ? "DIRECT_URL" : null;
if (directKey && !isPostgresUrl(process.env[directKey])) {
  errors.push(
    `${directKey} harus berupa URL koneksi PostgreSQL yang valid.\n` +
      "  Isi koneksi langsung dari penyedia database, atau hapus variabel opsional ini\n" +
      "  agar migrasi memakai DATABASE_URL.",
  );
}

const email = process.env.ADMIN_EMAIL?.trim() ?? "";
if (!z.email().safeParse(email).success) {
  errors.push(
    "ADMIN_EMAIL belum di-set atau format email tidak valid.\n" +
      `  Tambahkan email akun admin di ${settings}.`,
  );
}

const pw = process.env.ADMIN_PASSWORD ?? "";
if (!pw.trim() || pw.trim() === "ganti-password-ini") {
  errors.push(
    "ADMIN_PASSWORD belum di-set (atau masih contoh dari .env.example).\n" +
      `  Tambahkan password admin pilihan Anda di ${settings}.`,
  );
}

if (!isPostgresSchemaInSync()) errors.push(OUT_OF_SYNC_MESSAGE);

if (errors.length > 0) {
  for (const e of errors) console.error(`ERROR: ${e}`);
  console.error(
    "Setelah menyimpan variabel, buat deployment baru dari commit terbaru.\n" +
      "File .env lokal tidak otomatis dikirim ke Vercel. Lihat README bagian troubleshooting deploy.",
  );
  process.exit(1);
}
if (!process.env.NEXT_PUBLIC_BASE_URL) {
  console.log("NEXT_PUBLIC_BASE_URL opsional: link WhatsApp memakai alamat website yang sedang dibuka.");
}
console.log("Konfigurasi deploy OK. Koneksi database akan diperiksa saat migrasi.");
