import { SCHEDULE } from "@/config/schedule";
import { listTickets, type TicketView } from "./booking";
import { AppError } from "./errors";
import { prisma } from "./prisma";

export type ReportStatus = "ACTIVE" | "BOOKED" | "CHECKED_IN" | "CANCELLED";
export type ReportFilter = { date?: string; sessionOrder?: number; status?: ReportStatus; q?: string };
export type RegistrationRow = Omit<TicketView, "session"> & {
  session: TicketView["session"] | null;
  cancelledAt: string | null;
};
export const REPORT_STATUS_LABEL = {
  BOOKED: "Belum check-in",
  CHECKED_IN: "Sudah check-in",
  CANCELLED: "Dibatalkan",
} as const;

/** Filter halaman dan ekspor memakai aturan yang sama. */
export function parseReportFilter(params: URLSearchParams): ReportFilter {
  const date = params.get("date")?.trim() || undefined;
  const session = params.get("session")?.trim() || undefined;
  const status = params.get("status")?.trim() || undefined;
  const q = params.get("q")?.trim() || undefined;
  if (date && !SCHEDULE.some((day) => day.date === date)) throw new AppError(400, "Tanggal laporan tidak tersedia.");
  if (session && !/^[1-6]$/.test(session)) throw new AppError(400, "Sesi laporan tidak valid.");
  if (status && !["ACTIVE", "BOOKED", "CHECKED_IN", "CANCELLED"].includes(status)) throw new AppError(400, "Status laporan tidak valid.");
  if (q && q.length > 120) throw new AppError(400, "Pencarian maksimal 120 karakter.");
  return { date, sessionOrder: session ? Number(session) : undefined, status: status as ReportStatus | undefined, q };
}

export function reportSearchParams(filter: ReportFilter): URLSearchParams {
  const params = new URLSearchParams();
  if (filter.date) params.set("date", filter.date);
  if (filter.sessionOrder) params.set("session", String(filter.sessionOrder));
  if (filter.status) params.set("status", filter.status);
  if (filter.q) params.set("q", filter.q);
  return params;
}

export function summarizeRegistrations(rows: RegistrationRow[]) {
  return {
    total: rows.length,
    uniquePeople: new Set(rows.map((row) => row.phone)).size,
    booked: rows.filter((row) => row.status === "BOOKED").length,
    checkedIn: rows.filter((row) => row.status === "CHECKED_IN").length,
    cancelled: rows.filter((row) => row.status === "CANCELLED").length,
  };
}

export async function getRegistrationReport(filter: ReportFilter = {}): Promise<RegistrationRow[]> {
  const includeCancelled = !filter.status || filter.status === "CANCELLED";
  const [active, cancelled] = await Promise.all([
    filter.status === "CANCELLED" ? Promise.resolve([]) : listTickets({
      date: filter.date,
      sessionOrder: filter.sessionOrder,
      status: filter.status === "ACTIVE" ? undefined : filter.status,
    }),
    includeCancelled ? prisma.cancelledTicket.findMany({
      where: filter.date ? { date: filter.date } : {},
    }) : Promise.resolve([]),
  ]);
  const sessions = cancelled.length ? await prisma.session.findMany({
    where: { id: { in: Array.from(new Set(cancelled.map((row) => row.sessionId))) } },
  }) : [];
  const sessionMap = new Map(sessions.map((session) => [session.id, session]));
  const archived: RegistrationRow[] = cancelled.map<RegistrationRow>((row) => {
    const session = sessionMap.get(row.sessionId);
    return {
      id: row.id, code: row.code, date: row.date,
      dayLabel: SCHEDULE.find((day) => day.date === row.date)?.label ?? row.date,
      queueNumber: row.queueNumber, name: row.name, phone: row.phone, email: row.email,
      status: "CANCELLED", createdAt: row.bookedAt.toISOString(),
      checkedInAt: row.checkedInAt?.toISOString() ?? null,
      cancelledAt: row.cancelledAt.toISOString(),
      session: session ? { id: session.id, order: session.order, startTime: session.startTime, endTime: session.endTime } : null,
    };
  }).filter((row) => !filter.sessionOrder || row.session?.order === filter.sessionOrder);
  const q = filter.q?.toLowerCase();
  const qPhone = q?.replace(/[\s\-().]/g, "");
  return [...active.map((row) => ({ ...row, cancelledAt: null })), ...archived]
    .filter((row) => !q || row.name.toLowerCase().includes(q) || row.code.toLowerCase().includes(q) || row.email?.toLowerCase().includes(q) || (qPhone && row.phone.includes(qPhone)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.code.localeCompare(b.code));
}
