import { EVENT } from "@/config/event";
import type { TicketView } from "@/lib/booking";

const STATUS_LABEL: Record<TicketView["status"], string> = {
  BOOKED: "Terpesan",
  CHECKED_IN: "Sudah check-in",
  CANCELLED: "Dibatalkan",
};

/** Kartu e-tiket bergaya tiket bioskop. `qrDataUrl` = QR berisi kode tiket. */
export function TicketCard({ ticket, qrDataUrl }: { ticket: TicketView; qrDataUrl: string }) {
  return (
    <div id="ticket-card" className="ticket" data-testid="ticket-card">
      <div className="ticket-edge" />
      <div className="ticket-main px-5 pb-5 pt-3 min-[400px]:px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-stone-500">
              E-Tiket Antrian
            </p>
            <p className="mt-0.5 text-lg font-black leading-tight tracking-tight">{EVENT.name}</p>
            <p className="text-xs text-stone-600">{EVENT.venue}</p>
          </div>
          <span
            data-testid="ticket-status"
            className={
              "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold " +
              (ticket.status === "CHECKED_IN"
                ? "bg-emerald-700 text-white"
                : "bg-stone-900 text-paper")
            }
          >
            {STATUS_LABEL[ticket.status]}
          </span>
        </div>

        <div className="mt-5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-stone-500">
            Nomor antrian
          </p>
          <p className="queue-number text-[5.5rem] text-stone-900" data-testid="ticket-number">
            {ticket.queueNumber}
          </p>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Tanggal</dt>
            <dd className="font-semibold">
              {ticket.dayLabel} {ticket.date.slice(0, 4)}
            </dd>
          </div>
          <div className="text-right">
            <dt className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
              Sesi {ticket.session.order}
            </dt>
            <dd className="font-mono font-semibold">
              {ticket.session.startTime}–{ticket.session.endTime} WIB
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Nama</dt>
            <dd className="break-words font-semibold" data-testid="ticket-name">
              {ticket.name}
            </dd>
          </div>
        </dl>
      </div>

      <div className="ticket-stub flex items-center gap-4 px-5 pb-3 pt-4 min-[400px]:px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrDataUrl}
          alt={`QR code tiket ${ticket.code}`}
          width={120}
          height={120}
          className="h-[120px] w-[120px] shrink-0 rounded-md"
          data-testid="ticket-qr"
        />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Kode tiket</p>
          <p className="font-mono text-lg font-black tracking-wide" data-testid="ticket-code">
            {ticket.code}
          </p>
          <p className="mt-1.5 text-[11px] leading-snug text-stone-600">
            Tunjukkan QR ini ke petugas saat check-in. Datang sesuai jam sesi Anda.
          </p>
        </div>
      </div>
      <div className="ticket-edge ticket-edge-bottom" />
    </div>
  );
}
