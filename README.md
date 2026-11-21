# Johnson Warehouse Sale — tiket otomatis

Pengunjung memilih tanggal → isi data → mendapat **e-tiket dengan sesi dan nomor acak otomatis, serta QR code**. Admin melihat pemesanan, **check-in dengan scan QR**, **export CSV**, dan mengatur nomor yang **sekarang dipanggil**. Tampilan panel kaca menggunakan latar hitam, teks putih/kuning, fokus keyboard, reduced motion, dan safe area ponsel.

Event: **27, 28, 29 November; 4, 5, 6 Desember; 11, 12, 13 Desember 2026**, zona waktu **Asia/Jakarta (WIB)**, 6 sesi × 50 nomor = 300 nomor/hari (2.700 tiket).

## Tech stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Prisma 7 (SQLite untuk development, PostgreSQL untuk production) · zod · qrcode · html5-qrcode · date-fns-tz · Vitest · Playwright.

## Menjalankan di komputer sendiri

Butuh Node.js 20+.

```bash
npm install                 # sekaligus menjalankan `prisma generate`
cp .env.example .env        # lalu isi ADMIN_EMAIL dan ADMIN_PASSWORD
npx prisma migrate deploy   # membuat tabel di dev.db (SQLite)
npm run seed                # mengisi 9 hari × 6 sesi dari src/config/schedule.ts
npm run dev                 # http://localhost:3000
```

`npm run setup` = `prisma migrate deploy` + seed dalam satu perintah.

| Variabel | Fungsi |
|---|---|
| `DATABASE_URL` | `file:./dev.db` (SQLite) atau `postgresql://…` |
| `ADMIN_EMAIL` | Email akun admin untuk login `/admin` |
| `ADMIN_PASSWORD` | Password login `/admin` |
| `NEXT_PUBLIC_BASE_URL` | Opsional: domain tetap untuk link WhatsApp. Jika kosong, memakai alamat website yang sedang dibuka |

**npm 12+ dan `allowScripts`.** npm 12 memblokir install script dependensi kecuali diizinkan di field `allowScripts` pada `package.json`. Yang diizinkan: `prisma`, `@prisma/engines`, `esbuild`, dan `better-sqlite3@12.11.1` (driver SQLite yang dipakai aplikasi). `better-sqlite3@13.1.1`, yang dipakai `scripts/db-init.ts`, sudah menyertakan binary untuk platform umum; langkah kompilasi implisitnya sengaja ditolak. Bila versi paket-paket ini berubah, jalankan `npm install-scripts ls` lalu perbarui daftarnya. Lihat [dokumentasi npm](https://docs.npmjs.com/cli/commands/npm-install-scripts/).

## Halaman

Login admin memakai satu akun dari `ADMIN_EMAIL` dan `ADMIN_PASSWORD` pada konfigurasi server, tanpa tabel akun di database. Buka `/admin/login`, lalu masukkan keduanya. Email tidak peka huruf besar-kecil. Mengubah email atau password membatalkan sesi admin sebelumnya. Simpan kredensial lokal di `.env` yang diabaikan Git; untuk Vercel, atur keduanya pada Environment Variables dan buat deployment baru.

| Publik | |
|---|---|
| `/` | Pilih tanggal (sisa kuota per hari; tanggal lewat nonaktif) |
| `/[date]` | Link lama diarahkan ke formulir tanggal tersebut |
| `/[date]/[sessionId]` | Link lama diarahkan ke formulir tanpa memilih sesi |
| `/checkout?date=YYYY-MM-DD` | Isi data; sesi dan nomor dialokasikan saat konfirmasi |
| `/ticket/[code]` | E-tiket + QR, simpan sebagai gambar, bagikan ke WhatsApp |
| `/cari` | Cari tiket dengan nomor WhatsApp |
| `/display/[date]` | Layar "Sekarang dipanggil" untuk TV di lokasi |

| Admin (perlu login) | |
|---|---|
| `/admin` | Dashboard per tanggal & sesi (terisi / sisa / check-in), export CSV, set nomor dipanggil |
| `/admin/tickets` | Daftar tiket + filter & pencarian, check-in manual, batalkan |
| `/admin/checkin` | Scan QR dengan kamera atau ketik kode. Kamera butuh HTTPS (atau `localhost`) |

## Mengubah jadwal, nama event, dan aturan

- **Jadwal** — `src/config/schedule.ts` adalah satu-satunya sumber kebenaran. Edit, lalu `npm run seed`. Rentang nomor dihitung otomatis: sesi ke-i → `(i×50+1)`–`(i×50+50)`.
- **Nama event, logo, warna** — `src/config/event.ts` (`EVENT`). Logo ditaruh di `public/`.
- **Aturan pemesanan** — `BOOKING_RULES` di file yang sama: maks. tiket per nomor HP per hari, cut-off pemesanan, toleransi check-in lebih awal. Pengaturan hold hanya untuk kompatibilitas data lama.

## Aturan bisnis yang dijaga

1. **Tanpa nomor ganda** — transaksi mengunci baris tanggal (`EventDay.bookingRevision`) sebelum membaca kuota dan membuat tiket. Unique constraint `(date, queueNumber)` menjadi pengaman tambahan. Bentrok transaksi/kode acak dicoba ulang terbatas. Tidak bergantung pada memori satu server.
2. Sistem memilih secara acak satu sesi yang belum dimulai dan masih memiliki kuota, lalu mengacak satu nomor kosong dalam sesi tersebut menggunakan `crypto.randomInt`. Sesi penuh dilewati. Setiap tanggal memiliki rentang nomor sendiri (1–300). Batas satu tiket aktif per WhatsApp per tanggal diperiksa dalam transaksi yang sama.
3. Istirahat tidak punya sesi/nomor sehingga tidak bisa dipesan.
4. Semua perhitungan waktu memakai Asia/Jakarta (`src/lib/time.ts`), bukan zona server.
5. Kode tiket seperti `JM-027-X7K2`, tanpa karakter ambigu (0/O, 1/I/L).
6. API hanya menerima tanggal, nama, WhatsApp, dan email opsional. Input `sessionId`, `queueNumber`, atau `holdId` ditolak. POST hold lama mengembalikan 410; reservasi lama tetap dihormati hingga kedaluwarsa.
7. **Pembatalan** memindahkan tiket ke tabel arsip `CancelledTicket` lalu menghapus barisnya, sehingga nomor langsung bisa dipesan lagi dan unique constraint tetap konsisten.

Migrasi hanya menambah kolom; seed memperbarui jadwal melalui upsert tanpa menghapus tiket yang sudah ada. Perubahan dilakukan dalam transaksi per tanggal dan dibatalkan bila rentang baru tidak mencakup tiket yang sudah terbit. Jika koneksi putus setelah pemesanan, tiket dapat ditemukan lewat menu Cari tiket.

## Respons perpindahan halaman

- Link internal melakukan prefetch dan menampilkan respons langsung saat diklik. Loading boundary menjaga navigasi tetap responsif saat server sedang memuat data.
- Halaman isi data memakai jadwal konfigurasi tanpa query database. Kuota terbaru tetap divalidasi dalam transaksi saat tombol Pesan tiket ditekan.
- Pemesanan memakai data yang sudah dibaca dalam transaksi untuk menghindari pembacaan ulang tiket dan sesi. Tombol tetap terkunci hingga halaman tiket terbuka.

## Tes

```bash
npm test            # Vitest: jadwal vs tabel spesifikasi, util waktu, kode tiket, booking, API, middleware
npm run test:e2e    # Playwright: alur lengkap di viewport 320px, 390px & 1280px
npm run test:postgres # PostgreSQL: pemesanan serentak dari empat proses
npm run lint
npm run build
```

- Tes memakai database terpisah (`test.db`, `e2e.db`) yang dibuat oleh `scripts/db-init.ts` langsung dari file migrasi.
- E2E membekukan waktu lewat env `TEST_NOW` (Jumat 27 Nov 2026 13:40 WIB). **Jangan set `TEST_NOW` di production.**
- Playwright pertama kali: `npx playwright install chromium`. Alternatif Chrome lokal: set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` ke executable Chrome.
- Tes membuat client SQLite; `npm run build` membuat ulang client sesuai database konfigurasi.
- `test:postgres` memakai schema sementara terisolasi, lalu menghapus schema tersebut. Membutuhkan PostgreSQL di `.env`; data schema publik tidak disentuh.

## Deploy ke Vercel + PostgreSQL

SQLite tidak bisa dipakai di Vercel (filesystem tidak permanen), jadi production memakai PostgreSQL. Repo ini sudah siap: cukup klik-klik di dashboard Vercel, tidak perlu Node.js di komputer sendiri.

> Jangan pakai fitur deploy dari Prisma (Prisma Compute): fitur itu mewajibkan Prisma ORM 8, sedangkan aplikasi ini memakai Prisma 7.

1. Di [vercel.com](https://vercel.com): **Add New → Project**, import repo GitHub ini. Jangan klik Deploy dulu.
2. Di project tersebut buka **Storage** dan periksa apakah database sudah terhubung. Jika belum, hubungkan PostgreSQL melalui [Vercel Marketplace](https://vercel.com/marketplace?category=databases&search=postgres), misalnya Neon. Setelah terhubung, periksa variabel `DATABASE_URL` di **Settings → Environment Variables**; pilih **Production** (dan **Preview** bila memakai preview). Jika integrasi memakai nama/prefix lain, salin nilai koneksinya ke `DATABASE_URL`. Jangan gunakan `file:./dev.db`. `DATABASE_URL_UNPOOLED` atau `DIRECT_URL` opsional untuk koneksi migrasi langsung; jangan isi kosong.
3. **Settings → Environment Variables**, tambahkan:
   - `ADMIN_EMAIL`: email akun admin, pada environment yang sama dengan database.
   - `ADMIN_PASSWORD`: password halaman `/admin` pilihan Anda, pada environment yang sama dengan database.
   - `NEXT_PUBLIC_BASE_URL` **opsional**: URL publik sebenarnya. Jika belum tahu domainnya, biarkan tidak di-set; tombol WhatsApp otomatis memakai alamat website yang dibuka.
   - `.env.production.example` berisi daftar variabel sebagai panduan. File `.env` di komputer sendiri tidak otomatis menjadi pengaturan Vercel.
4. Buat **deployment baru dari commit terbaru** setelah menyimpan variabel. Periksa commit di bagian Source deployment; Redeploy terhadap deployment lama tetap memakai source commit lama. `vercel.json` menjalankan `npm run vercel-build`, yang berisi:
   1. `scripts/predeploy-check.mjs`: berhenti dengan pesan jelas bila `DATABASE_URL` bukan PostgreSQL, `ADMIN_EMAIL` tidak valid, atau `ADMIN_PASSWORD` kosong
   2. `prisma generate` + `prisma migrate deploy`: membuat/memperbarui tabel
   3. seed jadwal (aman diulang; perubahan di `src/config/schedule.ts` ikut terbawa tiap deploy, jadi jangan ubah rentang nomor sesi yang tiketnya sudah terjual)
   4. `next build`

### Troubleshooting deploy

| Pesan di log | Penyebab dan tindakan |
|---|---|
| `install scripts not yet covered by allowScripts` | Periksa commit Source deployment dan `package.json` yang dipakai. Daftar izin sudah ditambahkan pada commit `10e9bc9`. Jika log masih menyebut keenam paket yang sama, pastikan deployment memakai commit tersebut atau yang lebih baru dan Root Directory mengarah ke folder aplikasi. Untuk versi paket baru, tinjau dengan `npm install-scripts ls`. |
| `Unknown env config "cache-dir"` | Peringatan konfigurasi npm; bukan penyebab penghentian oleh pemeriksaan deploy. Repo ini tidak mengatur `cache-dir`. Jika Anda menambahkan `npm_config_cache_dir` di environment Vercel, hapus atau gunakan `npm_config_cache`. |
| `DATABASE_URL` kosong/tidak valid | Hubungkan database PostgreSQL dan pastikan variabel tersedia untuk environment deployment. SQLite lokal tidak cocok untuk penyimpanan di Vercel. |
| `ADMIN_PASSWORD` kosong/contoh | Isi password admin di pengaturan environment Vercel. Jangan simpan password di Git. |
| `ADMIN_EMAIL` kosong/tidak valid | Isi email akun admin di pengaturan environment Vercel, lalu login memakai email tersebut dan password yang telah diatur. |

`npm run deploy:check` memeriksa variabel environment proses dan kesesuaian schema tanpa mengubah database; perintah ini tidak memuat `.env` lokal. Kelulusan pemeriksaan belum membuktikan koneksi database: koneksi baru digunakan oleh langkah migrasi berikutnya. Perubahan variabel Vercel berlaku pada deployment baru, sesuai [dokumentasi Vercel](https://vercel.com/docs/environment-variables).

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
