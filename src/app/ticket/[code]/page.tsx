import { NavLink as Link } from "@/components/NavLink";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { EVENT } from "@/config/event";
import { PageShell } from "@/components/SiteHeader";
import { Stepper } from "@/components/Stepper";
import { TicketActions } from "@/components/TicketActions";
import { TicketCard } from "@/components/TicketCard";
import { getTicketByCode } from "@/lib/booking";

export const dynamic = "force-dynamic";
export const metadata = { title: "E-Tiket", robots: { index: false } };

export default async function TicketPage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams: { baru?: string };
}) {
  const ticket = await getTicketByCode(params.code);
  if (!ticket) notFound();

  // Isi QR = kode tiket (dipindai di halaman admin check-in).
  const qrDataUrl = await QRCode.toDataURL(ticket.code, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 360,
    color: { dark: "#1c1917", light: "#ffffff" },
  });

  const shareText = `Tiket antrian ${EVENT.name}\nNo. ${ticket.queueNumber} · ${ticket.dayLabel} · Sesi ${ticket.session.order} (${ticket.session.startTime}–${ticket.session.endTime} WIB)\nKode: ${ticket.code}`;

  return (
    <PageShell>
      <Stepper current={3} />
      {searchParams.baru && (
        <p role="status" className="mx-auto mb-5 max-w-sm rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-3 text-center text-sm text-primary">
          Pemesanan berhasil! Simpan tiket ini atau buka lagi kapan saja lewat link halaman ini.
        </p>
      )}
      <TicketCard ticket={ticket} qrDataUrl={qrDataUrl} />
      <TicketActions
        code={ticket.code}
        shareText={shareText}
        baseUrl={process.env.NEXT_PUBLIC_BASE_URL ?? ""}
      />
      <p className="mt-6 text-center text-sm">
        <Link href="/" className="text-stone-400 underline-offset-4 hover:text-primary hover:underline">
          Kembali ke halaman utama
        </Link>
      </p>
    </PageShell>
  );
}
