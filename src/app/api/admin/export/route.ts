import { listTickets } from "@/lib/booking";
import { api } from "@/lib/errors";
import { formatEventDateTime } from "@/lib/time";
import { dateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

function csvCell(v: string | number | null): string {
  let s = v === null ? "" : String(v);
  // Cegah CSV/formula injection saat dibuka di Excel.
  if (/^[=+\-@\t\r]/.test(s) && !/^[+-]?\d+$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const GET = api(async (req: Request) => {
  const date = dateSchema.parse(new URL(req.url).searchParams.get("date") ?? "");
  const tickets = await listTickets({ date });
  const header = [
    "Kode", "Tanggal", "Sesi", "Jam", "No. Antrian", "Nama", "WhatsApp", "Email",
    "Status", "Waktu Check-in", "Waktu Pesan",
  ];
  const rows = tickets.map((t) => [
    t.code,
    t.date,
    t.session.order,
    `${t.session.startTime}-${t.session.endTime}`,
    t.queueNumber,
    t.name,
    // Diawali apostrof agar nol di depan tidak hilang di Excel.
    `'${t.phone}`,
    t.email,
    t.status,
    t.checkedInAt ? formatEventDateTime(new Date(t.checkedInAt)) : "",
    formatEventDateTime(new Date(t.createdAt)),
  ]);
  const csv =
    "﻿" + [header, ...rows].map((r) => r.map((c) => csvCell(c)).join(",")).join("\r\n") + "\r\n";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tiket-${date}.csv"`,
    },
  });
});
