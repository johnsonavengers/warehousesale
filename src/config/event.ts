/**
 * Identitas event & aturan pemesanan. Ganti nama, logo, dan warna di sini.
 */
export const EVENT = {
  name: "Johnson Warehouse Sale",
  tagline: "Pesan nomor antrian Anda, datang sesuai sesi.",
  venue: "Lokasi Event",
  /** Path logo di folder /public (mis. "/logo.png"). Kosongkan untuk memakai inisial. */
  logo: "",
  /** Warna utama (hex). Dipakai untuk tombol, nomor terpilih, aksen tiket. */
  primaryColor: "#f59e0b",
  /** Warna teks di atas warna utama. */
  primaryTextColor: "#1c1917",
} as const;

export const BOOKING_RULES = {
  /** Lama nomor dikunci saat checkout (menit). */
  holdMinutes: 5,
  /** Jumlah nomor per transaksi. */
  maxNumbersPerBooking: 1,
  /** Maks. tiket aktif per nomor HP per hari. */
  maxActiveTicketsPerPhonePerDay: 1,
  /** Pemesanan ditutup N menit SEBELUM jam mulai sesi (0 = tepat saat sesi mulai). */
  bookingCutoffMinutes: 0,
  /** Check-in dianggap "sesi belum dibuka" jika lebih awal dari N menit sebelum sesi. */
  checkinEarlyMinutes: 60,
  /** Interval refresh denah nomor (ms). */
  seatPollIntervalMs: 5000,
} as const;
