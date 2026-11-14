/**
 * Titik sambung untuk pengembangan lanjutan (di luar cakupan saat ini):
 *  - Notifikasi WhatsApp/email otomatis → kirim dari `onTicketCreated`.
 *  - Pembayaran (Midtrans/Xendit) → buat transaksi di sini, tambahkan status
 *    PENDING_PAYMENT pada enum TicketStatus, dan konfirmasi lewat webhook.
 * Hook dipanggil setelah tiket tersimpan; kegagalan hook tidak membatalkan tiket.
 */
import type { TicketView } from "./booking";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function onTicketCreated(ticket: TicketView): Promise<void> {
  // Belum ada aksi. Contoh: await sendWhatsApp(ticket.phone, linkTiket(ticket.code));
}
