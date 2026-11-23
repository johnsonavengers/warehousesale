import { EVENT } from "@/config/event";
import type { TicketView } from "@/lib/booking";
import { Icon } from "./Icon";
const STATUS_LABEL: Record<TicketView["status"], string> = { BOOKED: "Terpesan", CHECKED_IN: "Sudah check-in", CANCELLED: "Dibatalkan" };
export function TicketCard({ ticket, qrDataUrl }: { ticket: TicketView; qrDataUrl: string }) {
  return <div id="ticket-card" className="ticket" data-testid="ticket-card">
    <div className="p-6 pb-5">
      <div className="flex items-start justify-between gap-2"><div><p className="eyebrow text-[9px] text-primary">Your warehouse pass</p><p className="mt-2 max-w-[170px] text-lg font-semibold leading-tight tracking-tight">{EVENT.name}</p></div><Icon name="ticket" className="h-6 w-6 shrink-0 text-primary" /></div>
      <div className="mt-5 rounded-2xl border border-primary/30 bg-primary/[0.08] p-4" data-testid="ticket-schedule"><p className="text-xs font-semibold text-primary">Jam kunjungan · Sesi {ticket.session.order}</p><p className="mt-2 text-2xl font-semibold tracking-tight text-white" data-testid="ticket-time"><time dateTime={`${ticket.date}T${ticket.session.startTime}:00+07:00`}>{ticket.session.startTime}</time>–<time dateTime={`${ticket.date}T${ticket.session.endTime}:00+07:00`}>{ticket.session.endTime}</time> <span className="text-xs font-medium text-primary">WIB</span></p><p className="mt-2 text-xs text-stone-200">{ticket.dayLabel} {ticket.date.slice(0, 4)}</p></div>
      <div className="my-6 text-center"><p className="eyebrow">Nomor antrian</p><p className="queue-number mt-2 text-[6rem] text-primary" data-testid="ticket-number">{ticket.queueNumber}</p><span data-testid="ticket-status" className="mt-3 inline-block rounded-full border border-white/15 px-3 py-1 text-[10px] font-medium text-stone-200">{STATUS_LABEL[ticket.status]}</span></div>
      <div className="mt-5"><p className="eyebrow">Atas nama</p><p className="mt-1 break-words text-sm font-medium" data-testid="ticket-name">{ticket.name}</p></div>
    </div>
    <div className="ticket-stub flex flex-col items-center gap-4 px-5 py-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrDataUrl} alt={`QR code tiket ${ticket.code}`} width={144} height={144} className="h-36 w-36 rounded-2xl bg-white p-2" data-testid="ticket-qr" />
      <div><p className="font-mono text-base font-semibold tracking-wider text-primary" data-testid="ticket-code">{ticket.code}</p><p className="mx-auto mt-2 max-w-[230px] text-[11px] leading-relaxed text-stone-300">Tunjukkan QR ini ke petugas saat check-in.<br />Datang sesuai jam sesi di atas.</p></div>
    </div>
  </div>;
}
