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

SQLite tidak bisa dipakai di Vercel (filesystem tidak permanen), jadi production memakai PostgreSQL. Repo ini sudah siap: cukup klik-klik di dashboard Vercel, tidak perlu Node.js di komputer sendiri.

> Jangan pakai fitur deploy dari Prisma (Prisma Compute): fitur itu mewajibkan Prisma ORM 8, sedangkan aplikasi ini memakai Prisma 7.

1. Di [vercel.com](https://vercel.com): **Add New → Project**, import repo GitHub ini. Jangan klik Deploy dulu.
2. Di project tersebut buka tab **Storage → Create Database → Neon (Postgres)**, lalu hubungkan ke project. Vercel otomatis mengisi `DATABASE_URL` (pooled) dan `DATABASE_URL_UNPOOLED` (untuk migrasi).
3. **Settings → Environment Variables**, tambahkan:
   - `ADMIN_PASSWORD`: password halaman `/admin`
   - `NEXT_PUBLIC_BASE_URL`: URL aplikasi, mis. `https://warehousesale.vercel.app` (bisa diisi setelah tahu domainnya, lalu Redeploy)
4. **Deploy** (atau **Redeploy**). `vercel.json` menjalankan `npm run vercel-build`, yang berisi:
   1. `scripts/predeploy-check.mjs`: berhenti dengan pesan jelas bila `DATABASE_URL` bukan PostgreSQL atau `ADMIN_PASSWORD` kosong
   2. `prisma generate` + `prisma migrate deploy`: membuat/memperbarui tabel
   3. seed jadwal (aman diulang; perubahan di `src/config/schedule.ts` ikut terbawa tiap deploy, jadi jangan ubah rentang nomor sesi yang tiketnya sudah terjual)
   4. `next build`

### Dua database: SQLite (lokal) dan PostgreSQL (production)

`DATABASE_URL` menentukan semuanya. `prisma.config.ts` memilih schema & folder migrasi, dan `src/lib/prisma.ts` memilih driver:

| `DATABASE_URL` | Schema | Migrasi |
|---|---|---|
| `file:./dev.db` | `prisma/schema.prisma` | `prisma/migrations` |
| `postgresql://…` | `prisma/postgresql/schema.prisma` | `prisma/postgresql/migrations` |

`prisma/schema.prisma` adalah satu-satunya yang diedit. Versi PostgreSQL dibuat otomatis darinya. Bila mengubah model:

```bash
# 1. edit prisma/schema.prisma, lalu buat migrasi SQLite
npx prisma migrate dev --name nama_perubahan
# 2. salin perubahan ke schema PostgreSQL
npm run db:pg-schema
# 3. buat migrasi PostgreSQL (pakai database Postgres kosong untuk development, mis. branch Neon)
DATABASE_URL="postgresql://…" npx prisma migrate dev --name nama_perubahan
```

Commit kedua folder migrasi. Build Vercel gagal dengan pesan jelas bila langkah 2 terlupa.

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
