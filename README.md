# Aplikasi Tiket Antrian (gaya tiket bioskop)

Web app pemesanan **nomor antrian**: pengunjung memilih tanggal → sesi → nomor dari denah (seperti kursi bioskop) → isi data → dapat **e-tiket dengan QR code**. Admin melihat pemesanan, **check-in dengan scan QR**, **export CSV**, dan mengatur nomor yang **sekarang dipanggil**.

Event: **Jumat 27 – Minggu 29 November 2026**, zona waktu **Asia/Jakarta (WIB)**, 6 sesi × 30 nomor = 180 nomor/hari (540 tiket).

## Tech stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Prisma 7 (SQLite untuk development, PostgreSQL untuk production) · zod · qrcode · html5-qrcode · date-fns-tz · Vitest · Playwright.

## Menjalankan di komputer sendiri

Butuh Node.js 20+.

```bash
npm install                 # sekaligus menjalankan `prisma generate`
cp .env.example .env        # lalu ganti ADMIN_PASSWORD
npx prisma migrate deploy   # membuat tabel di dev.db (SQLite)
npm run seed                # mengisi 3 hari × 6 sesi dari src/config/schedule.ts
npm run dev                 # http://localhost:3000
```

`npm run setup` = `prisma migrate deploy` + seed dalam satu perintah.

| Variabel | Fungsi |
|---|---|
| `DATABASE_URL` | `file:./dev.db` (SQLite) atau `postgresql://…` |
| `ADMIN_PASSWORD` | Password login `/admin` |
| `NEXT_PUBLIC_BASE_URL` | URL publik, dipakai untuk link tiket di tombol "Bagikan ke WhatsApp" |

## Halaman

| Publik | |
|---|---|
| `/` | Pilih tanggal (sisa kuota per hari; tanggal lewat nonaktif) |
| `/[date]` | Pilih sesi (blok Istirahat di posisi yang benar; sesi penuh/sudah mulai nonaktif) |
| `/[date]/[sessionId]` | Denah 30 nomor, legenda, "Pilih nomor otomatis", refresh tiap 5 detik |
| `/checkout?hold=…` | Isi data; nomor dikunci 5 menit dengan countdown |
| `/ticket/[code]` | E-tiket + QR, simpan sebagai gambar, bagikan ke WhatsApp |
| `/cari` | Cari tiket dengan nomor WhatsApp |
| `/display/[date]` | Layar "Sekarang dipanggil" untuk TV di lokasi |

| Admin (perlu login) | |
|---|---|
| `/admin` | Dashboard per tanggal & sesi (terisi / sisa / check-in), export CSV, set nomor dipanggil |
| `/admin/tickets` | Daftar tiket + filter & pencarian, check-in manual, batalkan |
| `/admin/checkin` | Scan QR dengan kamera atau ketik kode. Kamera butuh HTTPS (atau `localhost`) |

## Mengubah jadwal, nama event, dan aturan

- **Jadwal** — `src/config/schedule.ts` adalah satu-satunya sumber kebenaran. Edit, lalu `npm run seed`. Rentang nomor dihitung otomatis: sesi ke-i → `(i×30+1)`–`(i×30+30)`.
- **Nama event, logo, warna** — `src/config/event.ts` (`EVENT`). Logo ditaruh di `public/`.
- **Aturan pemesanan** — `BOOKING_RULES` di file yang sama: lama hold, maks. tiket per nomor HP per hari, cut-off pemesanan, toleransi check-in lebih awal, interval refresh denah.

## Aturan bisnis yang dijaga

1. **Tanpa double booking** — unique constraint `(date, queueNumber)` di tabel `Ticket` dan `Hold`, plus transaksi. Bentrok → HTTP 409 "Nomor ini baru saja diambil orang lain, silakan pilih nomor lain."
2. Server memvalidasi nomor berada di rentang sesinya (400 jika tidak).
3. Istirahat tidak punya sesi/nomor sehingga tidak bisa dipesan.
4. Semua perhitungan waktu memakai Asia/Jakarta (`src/lib/time.ts`), bukan zona server.
5. Kode tiket seperti `JM-027-X7K2`, tanpa karakter ambigu (0/O, 1/I/L).
6. Hold kedaluwarsa dibersihkan saat ada request (tanpa cron).
7. **Pembatalan** memindahkan tiket ke tabel arsip `CancelledTicket` lalu menghapus barisnya, sehingga nomor langsung bisa dipesan lagi dan unique constraint tetap konsisten.

Semua error API berformat `{ "error": "…" }` dengan status 400/401/404/409.

## Tes

```bash
npm test            # Vitest: jadwal vs tabel spesifikasi, util waktu, kode tiket, booking, API, middleware
npm run test:e2e    # Playwright: alur lengkap di viewport 390px & 1280px
npm run lint
npm run build
```

- Tes memakai database terpisah (`test.db`, `e2e.db`) yang dibuat oleh `scripts/db-init.ts` langsung dari file migrasi.
- E2E membekukan waktu lewat env `TEST_NOW` (Jumat 27 Nov 2026 13:40 WIB). **Jangan set `TEST_NOW` di production.**
- Playwright pertama kali: `npx playwright install chromium`.

## Deploy ke Vercel + PostgreSQL

SQLite tidak bisa dipakai di Vercel (filesystem tidak permanen), jadi production memakai PostgreSQL (Vercel Postgres, Neon, Supabase, dll.).

1. Di `prisma/schema.prisma` ganti `provider = "sqlite"` menjadi `provider = "postgresql"`.
2. Migrasi SQLite tidak kompatibel dengan PostgreSQL. Hapus folder `prisma/migrations`, set `DATABASE_URL` ke database PostgreSQL, lalu buat migrasi baru:
   ```bash
   npx prisma migrate dev --name init
   ```
3. Commit perubahan dan import repo ke Vercel. Isi Environment Variables: `DATABASE_URL`, `ADMIN_PASSWORD`, `NEXT_PUBLIC_BASE_URL` (mis. `https://antrian.contoh.id`).
4. Build command bawaan (`npm run build` = `prisma generate && next build`) sudah cukup. Untuk menerapkan migrasi otomatis saat deploy, ubah build command menjadi `prisma migrate deploy && npm run build`.
5. Seed jadwal sekali ke database production: `DATABASE_URL="postgresql://…" npm run seed`.

`src/lib/prisma.ts` memilih driver secara otomatis dari awalan `DATABASE_URL` (`file:` → better-sqlite3, `postgres://` → pg), jadi tidak ada kode lain yang perlu diubah. Gunakan connection string *pooled* untuk serverless.

## Struktur

```
prisma/schema.prisma, migrations/, seed.ts
src/config/schedule.ts      jadwal & kuota
src/config/event.ts         identitas event & aturan
src/lib/booking.ts          logika inti (ketersediaan, hold, tiket, check-in, batal)
src/lib/time.ts             util waktu Asia/Jakarta
src/lib/ticket-code.ts      generator kode tiket
src/lib/hooks.ts            titik sambung notifikasi / pembayaran (belum dipakai)
src/app/api/**              API routes
src/app/**                  halaman publik & admin
src/middleware.ts           proteksi /admin dan /api/admin
tests/                      unit test (Vitest)
e2e/                        end-to-end (Playwright)
```

## Pengembangan lanjutan (belum dibuat)

- **Pembayaran (Midtrans/Xendit)** dan **notifikasi WhatsApp/email**: sambungkan di `onTicketCreated` (`src/lib/hooks.ts`), yang dipanggil setiap tiket berhasil dibuat.
- **Multi-event**: tambahkan model `Event` dan relasi `eventId` pada `EventDay`; `src/config/event.ts` dan `schedule.ts` menjadi data per event.
