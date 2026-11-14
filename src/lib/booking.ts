/**
 * Layanan inti pemesanan: ketersediaan, hold, tiket, check-in, pembatalan.
 * Semua fungsi menerima `now` (default: waktu saat ini) supaya mudah diuji.
 */
import { BOOKING_RULES } from "@/config/event";
import { SLOT_CAPACITY, getScheduleDay } from "@/config/schedule";
import { AppError, SEAT_TAKEN_MESSAGE, isUniqueViolation } from "./errors";
import { prisma } from "./prisma";
import { generateTicketCode, normalizeTicketCode } from "./ticket-code";
import { eventDateTime, getNow, isBookingClosed, isDayPast, todayInEventTz } from "./time";

export type SeatStatus = "available" | "held" | "booked";

export type TicketView = {
  id: string;
  code: string;
  date: string;
  dayLabel: string;
  queueNumber: number;
  name: string;
  phone: string;
  email: string | null;
  status: "BOOKED" | "CHECKED_IN" | "CANCELLED";
  checkedInAt: string | null;
  createdAt: string;
  session: { id: string; order: number; startTime: string; endTime: string };
};

const ticketInclude = { session: { include: { eventDay: true } } } as const;

type TicketWithSession = NonNullable<
  Awaited<ReturnType<typeof findTicketByCodeRaw>>
>;

function findTicketByCodeRaw(code: string) {
  return prisma.ticket.findUnique({ where: { code }, include: ticketInclude });
}

export function toTicketView(t: TicketWithSession): TicketView {
  return {
    id: t.id,
    code: t.code,
    date: t.date,
    dayLabel: t.session.eventDay.label,
    queueNumber: t.queueNumber,
    name: t.name,
    phone: t.phone,
    email: t.email,
    status: t.status,
    checkedInAt: t.checkedInAt ? t.checkedInAt.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    session: {
      id: t.session.id,
      order: t.session.order,
      startTime: t.session.startTime,
      endTime: t.session.endTime,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Hold kedaluwarsa dibersihkan saat request (tanpa cron)              */
/* ------------------------------------------------------------------ */

export async function cleanupExpiredHolds(now: Date = getNow()): Promise<number> {
  const res = await prisma.hold.deleteMany({ where: { expiresAt: { lte: now } } });
  return res.count;
}

/* ------------------------------------------------------------------ */
/* Ketersediaan                                                        */
/* ------------------------------------------------------------------ */

async function takenCountsBySession(now: Date): Promise<Map<string, number>> {
  const [tickets, holds] = await Promise.all([
    prisma.ticket.groupBy({ by: ["sessionId"], _count: { _all: true } }),
    prisma.hold.groupBy({
      by: ["sessionId"],
      where: { expiresAt: { gt: now } },
      _count: { _all: true },
    }),
  ]);
  const map = new Map<string, number>();
  for (const t of tickets) map.set(t.sessionId, (map.get(t.sessionId) ?? 0) + t._count._all);
  for (const h of holds) map.set(h.sessionId, (map.get(h.sessionId) ?? 0) + h._count._all);
  return map;
}

export type DayOverview = {
  date: string;
  label: string;
  capacity: number;
  remaining: number;
  isPast: boolean;
  firstStart: string | null;
  lastEnd: string | null;
};

export async function getDaysOverview(now: Date = getNow()): Promise<DayOverview[]> {
  const [days, taken] = await Promise.all([
    prisma.eventDay.findMany({
      orderBy: { date: "asc" },
      include: { sessions: { orderBy: { order: "asc" } } },
    }),
    takenCountsBySession(now),
  ]);
  return days.map((d) => {
    let capacity = 0;
    let remaining = 0;
    for (const s of d.sessions) {
      const cap = s.queueEnd - s.queueStart + 1;
      capacity += cap;
      // Sesi yang sudah ditutup tidak dihitung sebagai sisa kuota.
      if (!isBookingClosed(d.date, s.startTime, now, BOOKING_RULES.bookingCutoffMinutes)) {
        remaining += Math.max(0, cap - (taken.get(s.id) ?? 0));
      }
    }
    return {
      date: d.date,
      label: d.label,
      capacity,
      remaining,
      isPast: isDayPast(d.date, now),
      firstStart: d.sessions[0]?.startTime ?? null,
      lastEnd: d.sessions[d.sessions.length - 1]?.endTime ?? null,
    };
  });
}

export type SessionItem = {
  type: "session";
  id: string;
  order: number;
  startTime: string;
  endTime: string;
  queueStart: number;
  queueEnd: number;
  capacity: number;
  remaining: number;
  started: boolean;
  full: boolean;
  bookable: boolean;
};
export type BreakItem = { type: "break"; startTime: string; endTime: string };
export type DaySessions = {
  date: string;
  label: string;
  isPast: boolean;
  items: (SessionItem | BreakItem)[];
};

export async function getSessionsForDay(
  date: string,
  now: Date = getNow(),
): Promise<DaySessions | null> {
  const day = await prisma.eventDay.findUnique({
    where: { date },
    include: { sessions: { orderBy: { order: "asc" } } },
  });
  if (!day) return null;
  const taken = await takenCountsBySession(now);
  const sessions: SessionItem[] = day.sessions.map((s) => {
    const capacity = s.queueEnd - s.queueStart + 1;
    const remaining = Math.max(0, capacity - (taken.get(s.id) ?? 0));
    const started = isBookingClosed(date, s.startTime, now, BOOKING_RULES.bookingCutoffMinutes);
    const full = remaining === 0;
    return {
      type: "session",
      id: s.id,
      order: s.order,
      startTime: s.startTime,
      endTime: s.endTime,
      queueStart: s.queueStart,
      queueEnd: s.queueEnd,
      capacity,
      remaining,
      started,
      full,
      bookable: !started && !full,
    };
  });
  const breaks: BreakItem[] = (getScheduleDay(date)?.breaks ?? []).map((b) => ({
    type: "break",
    startTime: b.start,
    endTime: b.end,
  }));
  // Istirahat disisipkan pada posisi waktu yang benar.
  const items = [...sessions, ...breaks].sort((a, b) => a.startTime.localeCompare(b.startTime));
  return { date: day.date, label: day.label, isPast: isDayPast(date, now), items };
}

export type SessionSeats = {
  session: {
    id: string;
    date: string;
    dayLabel: string;
    order: number;
    startTime: string;
    endTime: string;
    queueStart: number;
    queueEnd: number;
    started: boolean;
  };
  seats: { number: number; status: SeatStatus }[];
};

export async function getSeats(
  sessionId: string,
  now: Date = getNow(),
): Promise<SessionSeats | null> {
  const s = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      eventDay: true,
      tickets: { select: { queueNumber: true } },
      holds: { where: { expiresAt: { gt: now } }, select: { queueNumber: true } },
    },
  });
  if (!s) return null;
  const booked = new Set(s.tickets.map((t) => t.queueNumber));
  const held = new Set(s.holds.map((h) => h.queueNumber));
  const seats: SessionSeats["seats"] = [];
  for (let n = s.queueStart; n <= s.queueEnd; n++) {
    seats.push({ number: n, status: booked.has(n) ? "booked" : held.has(n) ? "held" : "available" });
  }
  return {
    session: {
      id: s.id,
      date: s.eventDay.date,
      dayLabel: s.eventDay.label,
      order: s.order,
      startTime: s.startTime,
      endTime: s.endTime,
      queueStart: s.queueStart,
      queueEnd: s.queueEnd,
      started: isBookingClosed(
        s.eventDay.date,
        s.startTime,
        now,
        BOOKING_RULES.bookingCutoffMinutes,
      ),
    },
    seats,
  };
}

/* ------------------------------------------------------------------ */
/* Hold                                                                */
/* ------------------------------------------------------------------ */

export type HoldView = {
  id: string;
  expiresAt: string;
  serverNow: string;
  queueNumber: number;
  date: string;
  dayLabel: string;
  session: { id: string; order: number; startTime: string; endTime: string };
};

export async function createHold(
  input: { sessionId: string; queueNumber: number },
  now: Date = getNow(),
): Promise<HoldView> {
  const session = await prisma.session.findUnique({
    where: { id: input.sessionId },
    include: { eventDay: true },
  });
  if (!session) throw new AppError(404, "Sesi tidak ditemukan");

  // Aturan 2: nomor harus berada di rentang sesi yang dipilih.
  if (input.queueNumber < session.queueStart || input.queueNumber > session.queueEnd) {
    throw new AppError(
      400,
      `Nomor ${input.queueNumber} tidak termasuk sesi ini (${session.queueStart}–${session.queueEnd}).`,
    );
  }
  const date = session.eventDay.date;
  if (isBookingClosed(date, session.startTime, now, BOOKING_RULES.bookingCutoffMinutes)) {
    throw new AppError(400, "Sesi ini sudah dimulai dan tidak bisa dipesan lagi.");
  }

  await cleanupExpiredHolds(now);

  try {
    const hold = await prisma.$transaction(async (tx) => {
      const existing = await tx.ticket.findUnique({
        where: { date_queueNumber: { date, queueNumber: input.queueNumber } },
        select: { id: true },
      });
      if (existing) throw new AppError(409, SEAT_TAKEN_MESSAGE);
      return tx.hold.create({
        data: {
          sessionId: session.id,
          date,
          queueNumber: input.queueNumber,
          expiresAt: new Date(now.getTime() + BOOKING_RULES.holdMinutes * 60_000),
        },
      });
    });
    return {
      id: hold.id,
      expiresAt: hold.expiresAt.toISOString(),
      serverNow: now.toISOString(),
      queueNumber: hold.queueNumber,
      date,
      dayLabel: session.eventDay.label,
      session: {
        id: session.id,
        order: session.order,
        startTime: session.startTime,
        endTime: session.endTime,
      },
    };
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError(409, SEAT_TAKEN_MESSAGE);
    throw e;
  }
}

export async function getHold(id: string, now: Date = getNow()): Promise<HoldView | null> {
  const hold = await prisma.hold.findUnique({
    where: { id },
    include: { session: { include: { eventDay: true } } },
  });
  if (!hold || hold.expiresAt.getTime() <= now.getTime()) return null;
  return {
    id: hold.id,
    expiresAt: hold.expiresAt.toISOString(),
    serverNow: now.toISOString(),
    queueNumber: hold.queueNumber,
    date: hold.date,
    dayLabel: hold.session.eventDay.label,
    session: {
      id: hold.session.id,
      order: hold.session.order,
      startTime: hold.session.startTime,
      endTime: hold.session.endTime,
    },
  };
}

export async function releaseHold(id: string): Promise<void> {
  await prisma.hold.deleteMany({ where: { id } });
}

/* ------------------------------------------------------------------ */
/* Tiket                                                               */
/* ------------------------------------------------------------------ */

const HOLD_EXPIRED_MESSAGE =
  "Waktu pemesanan habis atau nomor sudah dilepas. Silakan pilih nomor lagi.";

export async function createTicketFromHold(
  input: { holdId: string; name: string; phone: string; email?: string | null },
  now: Date = getNow(),
): Promise<TicketView> {
  const MAX_ATTEMPTS = 4;
  for (let attempt = 1; ; attempt++) {
    try {
      const ticket = await prisma.$transaction(async (tx) => {
        const hold = await tx.hold.findUnique({
          where: { id: input.holdId },
          include: { session: true },
        });
        if (!hold || hold.expiresAt.getTime() <= now.getTime()) {
          // Bila hold sudah tidak ada karena nomornya baru saja jadi tiket
          // (mis. klik ganda), balas sebagai konflik.
          throw new AppError(409, HOLD_EXPIRED_MESSAGE);
        }
        if (
          isBookingClosed(hold.date, hold.session.startTime, now, BOOKING_RULES.bookingCutoffMinutes)
        ) {
          throw new AppError(400, "Sesi ini sudah dimulai dan tidak bisa dipesan lagi.");
        }
        // Validasi ulang rentang nomor di sisi server.
        if (
          hold.queueNumber < hold.session.queueStart ||
          hold.queueNumber > hold.session.queueEnd
        ) {
          throw new AppError(400, "Nomor antrian tidak sesuai dengan sesi.");
        }
        const active = await tx.ticket.count({
          where: { date: hold.date, phone: input.phone },
        });
        if (active >= BOOKING_RULES.maxActiveTicketsPerPhonePerDay) {
          throw new AppError(
            409,
            "Nomor WhatsApp ini sudah memiliki tiket aktif untuk tanggal tersebut. Cek di menu “Cari tiket saya”.",
          );
        }
        const created = await tx.ticket.create({
          data: {
            code: generateTicketCode(hold.date, hold.queueNumber),
            sessionId: hold.sessionId,
            date: hold.date,
            queueNumber: hold.queueNumber,
            name: input.name,
            phone: input.phone,
            email: input.email ?? null,
          },
          include: ticketInclude,
        });
        await tx.hold.delete({ where: { id: hold.id } });
        return created;
      });
      return toTicketView(ticket);
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      // P2002: bentrok (date, queueNumber) → 409; bentrok kode tiket → coba kode baru.
      const hold = await prisma.hold.findUnique({ where: { id: input.holdId } });
      const taken = hold
        ? await prisma.ticket.findUnique({
            where: { date_queueNumber: { date: hold.date, queueNumber: hold.queueNumber } },
            select: { id: true },
          })
        : { id: "gone" };
      if (taken || attempt >= MAX_ATTEMPTS) throw new AppError(409, SEAT_TAKEN_MESSAGE);
    }
  }
}

export async function getTicketByCode(code: string): Promise<TicketView | null> {
  const t = await findTicketByCodeRaw(normalizeTicketCode(code));
  return t ? toTicketView(t) : null;
}

export async function findTicketsByPhone(phone: string): Promise<TicketView[]> {
  const tickets = await prisma.ticket.findMany({
    where: { phone },
    include: ticketInclude,
    orderBy: [{ date: "asc" }, { queueNumber: "asc" }],
  });
  return tickets.map(toTicketView);
}

/* ------------------------------------------------------------------ */
/* Admin: check-in, ubah status, batal                                 */
/* ------------------------------------------------------------------ */

export type CheckinResult = "ok" | "already" | "wrong_date" | "wrong_session" | "not_found";

export async function checkInByCode(
  input: { code: string; force?: boolean },
  now: Date = getNow(),
): Promise<{ result: "ok"; ticket: TicketView }> {
  const code = normalizeTicketCode(input.code);
  const t = await findTicketByCodeRaw(code);
  if (!t) {
    throw new AppError(404, `Tiket dengan kode “${code}” tidak ditemukan.`, {
      result: "not_found" satisfies CheckinResult,
    });
  }
  const view = toTicketView(t);
  if (t.status === "CHECKED_IN") {
    throw new AppError(409, "Tiket ini sudah check-in sebelumnya.", {
      result: "already" satisfies CheckinResult,
      ticket: view,
    });
  }
  if (!input.force) {
    if (todayInEventTz(now) !== t.date) {
      throw new AppError(409, `Salah tanggal: tiket ini untuk ${view.dayLabel}.`, {
        result: "wrong_date" satisfies CheckinResult,
        ticket: view,
      });
    }
    const opens =
      eventDateTime(t.date, t.session.startTime).getTime() -
      BOOKING_RULES.checkinEarlyMinutes * 60_000;
    const closes = eventDateTime(t.date, t.session.endTime).getTime();
    if (now.getTime() < opens || now.getTime() > closes) {
      throw new AppError(
        409,
        `Salah sesi: tiket ini untuk Sesi ${t.session.order} (${t.session.startTime}–${t.session.endTime} WIB).`,
        { result: "wrong_session" satisfies CheckinResult, ticket: view },
      );
    }
  }
  const updated = await prisma.ticket.update({
    where: { id: t.id },
    data: { status: "CHECKED_IN", checkedInAt: now },
    include: ticketInclude,
  });
  return { result: "ok", ticket: toTicketView(updated) };
}

/** Batalkan tiket: pindahkan ke arsip lalu hapus barisnya → nomor bebas lagi. */
export async function cancelTicket(id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const t = await tx.ticket.findUnique({ where: { id } });
    if (!t) throw new AppError(404, "Tiket tidak ditemukan");
    await tx.cancelledTicket.create({
      data: {
        code: t.code,
        sessionId: t.sessionId,
        date: t.date,
        queueNumber: t.queueNumber,
        name: t.name,
        phone: t.phone,
        email: t.email,
        checkedInAt: t.checkedInAt,
        bookedAt: t.createdAt,
      },
    });
    await tx.ticket.delete({ where: { id } });
  });
}

export async function updateTicketStatus(
  id: string,
  status: "BOOKED" | "CHECKED_IN" | "CANCELLED",
  now: Date = getNow(),
): Promise<{ status: string; ticket: TicketView | null }> {
  if (status === "CANCELLED") {
    await cancelTicket(id);
    return { status, ticket: null };
  }
  const exists = await prisma.ticket.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new AppError(404, "Tiket tidak ditemukan");
  const updated = await prisma.ticket.update({
    where: { id },
    data:
      status === "CHECKED_IN"
        ? { status, checkedInAt: now }
        : { status: "BOOKED", checkedInAt: null },
    include: ticketInclude,
  });
  return { status, ticket: toTicketView(updated) };
}

export type TicketFilter = {
  date?: string;
  sessionOrder?: number;
  status?: "BOOKED" | "CHECKED_IN";
  q?: string;
};

export async function listTickets(filter: TicketFilter = {}): Promise<TicketView[]> {
  const q = filter.q?.trim();
  const tickets = await prisma.ticket.findMany({
    where: {
      ...(filter.date ? { date: filter.date } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.sessionOrder ? { session: { order: filter.sessionOrder } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { phone: { contains: q.replace(/[\s-]/g, "") } },
              { code: { contains: q.toUpperCase() } },
            ],
          }
        : {}),
    },
    include: ticketInclude,
    orderBy: [{ date: "asc" }, { queueNumber: "asc" }],
  });
  return tickets.map(toTicketView);
}

export type DashboardDay = {
  date: string;
  label: string;
  totals: { capacity: number; booked: number; remaining: number; checkedIn: number };
  sessions: {
    id: string;
    order: number;
    startTime: string;
    endTime: string;
    queueStart: number;
    queueEnd: number;
    capacity: number;
    booked: number;
    remaining: number;
    checkedIn: number;
  }[];
};

export async function getDashboard(): Promise<DashboardDay[]> {
  const [days, grouped] = await Promise.all([
    prisma.eventDay.findMany({
      orderBy: { date: "asc" },
      include: { sessions: { orderBy: { order: "asc" } } },
    }),
    prisma.ticket.groupBy({ by: ["sessionId", "status"], _count: { _all: true } }),
  ]);
  const booked = new Map<string, number>();
  const checked = new Map<string, number>();
  for (const g of grouped) {
    booked.set(g.sessionId, (booked.get(g.sessionId) ?? 0) + g._count._all);
    if (g.status === "CHECKED_IN") checked.set(g.sessionId, g._count._all);
  }
  return days.map((d) => {
    const sessions = d.sessions.map((s) => {
      const capacity = s.queueEnd - s.queueStart + 1;
      const b = booked.get(s.id) ?? 0;
      return {
        id: s.id,
        order: s.order,
        startTime: s.startTime,
        endTime: s.endTime,
        queueStart: s.queueStart,
        queueEnd: s.queueEnd,
        capacity,
        booked: b,
        remaining: capacity - b,
        checkedIn: checked.get(s.id) ?? 0,
      };
    });
    const sum = (k: "capacity" | "booked" | "remaining" | "checkedIn") =>
      sessions.reduce((a, s) => a + s[k], 0);
    return {
      date: d.date,
      label: d.label,
      totals: {
        capacity: sum("capacity"),
        booked: sum("booked"),
        remaining: sum("remaining"),
        checkedIn: sum("checkedIn"),
      },
      sessions,
    };
  });
}

/* ------------------------------------------------------------------ */
/* "Sekarang dipanggil"                                                */
/* ------------------------------------------------------------------ */

export type NowServingView = {
  date: string;
  label: string;
  number: number | null;
  updatedAt: string | null;
  session: { order: number; startTime: string; endTime: string } | null;
  maxNumber: number;
};

export async function getNowServing(date: string): Promise<NowServingView | null> {
  const day = await prisma.eventDay.findUnique({
    where: { date },
    include: { sessions: { orderBy: { order: "asc" } } },
  });
  if (!day) return null;
  const row = await prisma.nowServing.findUnique({ where: { date } });
  const s = row
    ? day.sessions.find((x) => row.number >= x.queueStart && row.number <= x.queueEnd)
    : undefined;
  return {
    date,
    label: day.label,
    number: row?.number ?? null,
    updatedAt: row?.updatedAt.toISOString() ?? null,
    session: s ? { order: s.order, startTime: s.startTime, endTime: s.endTime } : null,
    maxNumber: day.sessions.length * SLOT_CAPACITY,
  };
}

/** number = 0 → kosongkan. */
export async function setNowServing(date: string, number: number): Promise<NowServingView> {
  const day = await prisma.eventDay.findUnique({
    where: { date },
    include: { sessions: true },
  });
  if (!day) throw new AppError(404, "Tanggal tidak ditemukan");
  const max = Math.max(0, ...day.sessions.map((s) => s.queueEnd));
  if (number > max) throw new AppError(400, `Nomor harus di antara 1 dan ${max}.`);
  if (number === 0) {
    await prisma.nowServing.deleteMany({ where: { date } });
  } else {
    await prisma.nowServing.upsert({
      where: { date },
      create: { date, number },
      update: { number },
    });
  }
  return (await getNowServing(date))!;
}
