import { beforeEach, describe, expect, it } from "vitest";
import { BOOKING_RULES } from "@/config/event";
import {
  cancelTicket,
  checkInByCode,
  createHold,
  createTicketFromHold,
  findTicketsByPhone,
  getDaysOverview,
  getHold,
  getNowServing,
  getSeats,
  getSessionsForDay,
  setNowServing,
} from "@/lib/booking";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { resetDb, sessionOf, wib } from "./helpers";

const FRI = "2026-11-27";
const SAT = "2026-11-28";
const BEFORE_EVENT = wib("2026-11-20", "09:00");

async function book(sessionId: string, queueNumber: number, phone: string, now = BEFORE_EVENT) {
  const hold = await createHold({ sessionId, queueNumber }, now);
  return createTicketFromHold({ holdId: hold.id, name: "Budi Santoso", phone }, now);
}

async function expectAppError(p: Promise<unknown>, status: number) {
  const err = await p.then(
    () => null,
    (e) => e,
  );
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).status).toBe(status);
  return err as AppError;
}

beforeEach(resetDb);

describe("seed", () => {
  it("menghasilkan 3 hari × 6 sesi = 18 sesi dengan rentang nomor yang benar", async () => {
    expect(await prisma.eventDay.count()).toBe(3);
    expect(await prisma.session.count()).toBe(18);
    const fri = await prisma.session.findMany({
      where: { eventDay: { date: FRI } },
      orderBy: { order: "asc" },
    });
    expect(fri.map((s) => [s.startTime, s.queueStart, s.queueEnd])).toEqual([
      ["10:00", 1, 30],
      ["10:45", 31, 60],
      ["14:00", 61, 90],
      ["14:45", 91, 120],
      ["15:30", 121, 150],
      ["16:15", 151, 180],
    ]);
    const sun = await prisma.session.findMany({
      where: { eventDay: { date: "2026-11-29" } },
      orderBy: { order: "asc" },
    });
    expect(sun.map((s) => [s.startTime, s.queueStart, s.queueEnd])).toEqual([
      ["10:15", 1, 30],
      ["11:00", 31, 60],
      ["11:45", 61, 90],
      ["14:00", 91, 120],
      ["14:45", 121, 150],
      ["15:30", 151, 180],
    ]);
  });

  it("seed idempoten (dijalankan ulang tidak menggandakan data)", async () => {
    await resetDb();
    expect(await prisma.session.count()).toBe(18);
  });
});

describe("daftar sesi & istirahat", () => {
  it("Jumat: istirahat 11:30–14:00 berada setelah sesi 2", async () => {
    const day = (await getSessionsForDay(FRI, BEFORE_EVENT))!;
    const labels = day.items.map((i) =>
      i.type === "break" ? `break ${i.startTime}-${i.endTime}` : `sesi ${i.order}`,
    );
    expect(labels).toEqual([
      "sesi 1", "sesi 2", "break 11:30-14:00", "sesi 3", "sesi 4", "sesi 5", "sesi 6",
    ]);
  });

  it("Sabtu & Minggu: istirahat 12:30–14:00 berada setelah sesi 3", async () => {
    for (const date of [SAT, "2026-11-29"]) {
      const day = (await getSessionsForDay(date, BEFORE_EVENT))!;
      const labels = day.items.map((i) =>
        i.type === "break" ? `break ${i.startTime}-${i.endTime}` : `sesi ${i.order}`,
      );
      expect(labels).toEqual([
        "sesi 1", "sesi 2", "sesi 3", "break 12:30-14:00", "sesi 4", "sesi 5", "sesi 6",
      ]);
    }
  });

  it("sesi yang sudah dimulai tidak bisa dipesan", async () => {
    const day = (await getSessionsForDay(FRI, wib(FRI, "10:50")))!;
    const sessions = day.items.filter((i) => i.type === "session");
    expect(sessions.map((s) => s.bookable)).toEqual([false, false, true, true, true, true]);
    const s1 = await sessionOf(FRI, 1);
    await expectAppError(createHold({ sessionId: s1.id, queueNumber: 5 }, wib(FRI, "10:00")), 400);
  });

  it("sisa kuota per hari & tanggal lewat", async () => {
    const s = await sessionOf(FRI, 1);
    await book(s.id, 1, "081234567801");
    const days = await getDaysOverview(BEFORE_EVENT);
    expect(days.map((d) => [d.date, d.capacity, d.remaining, d.isPast])).toEqual([
      [FRI, 180, 179, false],
      [SAT, 180, 180, false],
      ["2026-11-29", 180, 180, false],
    ]);
    const later = await getDaysOverview(wib(SAT, "09:00"));
    expect(later[0].isPast).toBe(true);
    expect(later[1].isPast).toBe(false);
  });
});

describe("aturan bisnis pemesanan", () => {
  it("nomor di luar rentang sesi ditolak (mis. nomor 45 pada sesi 61–90)", async () => {
    const s3 = await sessionOf(FRI, 3);
    expect([s3.queueStart, s3.queueEnd]).toEqual([61, 90]);
    const err = await expectAppError(
      createHold({ sessionId: s3.id, queueNumber: 45 }, BEFORE_EVENT),
      400,
    );
    expect(err.message).toContain("61–90");
    await expectAppError(createHold({ sessionId: s3.id, queueNumber: 91 }, BEFORE_EVENT), 400);
    expect(await prisma.hold.count()).toBe(0);
  });

  it("dua hold bersamaan untuk nomor yang sama → hanya satu sukses, satu 409", async () => {
    const s = await sessionOf(FRI, 1);
    const results = await Promise.allSettled([
      createHold({ sessionId: s.id, queueNumber: 7 }, BEFORE_EVENT),
      createHold({ sessionId: s.id, queueNumber: 7 }, BEFORE_EVENT),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).toBeInstanceOf(AppError);
    expect(failed[0].reason.status).toBe(409);
    expect(failed[0].reason.message).toContain("baru saja diambil orang lain");
  });

  it("submit ganda dari hold yang sama → tepat satu tiket", async () => {
    const s = await sessionOf(FRI, 1);
    const hold = await createHold({ sessionId: s.id, queueNumber: 8 }, BEFORE_EVENT);
    const results = await Promise.allSettled([
      createTicketFromHold({ holdId: hold.id, name: "A", phone: "081234567811" }, BEFORE_EVENT),
      createTicketFromHold({ holdId: hold.id, name: "B", phone: "081234567812" }, BEFORE_EVENT),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason.status).toBe(409);
    expect(await prisma.ticket.count({ where: { date: FRI, queueNumber: 8 } })).toBe(1);
  });

  it("unique constraint DB (date, queueNumber) mencegah double booking walau lewat jalur lain", async () => {
    const s = await sessionOf(FRI, 1);
    await book(s.id, 9, "081234567821");
    await expect(
      prisma.ticket.create({
        data: {
          code: "JM-009-ZZZZ", sessionId: s.id, date: FRI, queueNumber: 9,
          name: "X", phone: "081234567822",
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("nomor yang sama boleh dipakai di tanggal berbeda (reset per hari)", async () => {
    const fri = await sessionOf(FRI, 1);
    const sat = await sessionOf(SAT, 1);
    const a = await book(fri.id, 10, "081234567831");
    const b = await book(sat.id, 10, "081234567831");
    expect(a.code).toMatch(/^JM-010-/);
    expect(b.code).toMatch(/^SB-010-/);
  });

  it("nomor yang sudah jadi tiket tidak bisa di-hold lagi (409) & tampil 'booked'", async () => {
    const s = await sessionOf(FRI, 2);
    await book(s.id, 31, "081234567841");
    await expectAppError(createHold({ sessionId: s.id, queueNumber: 31 }, BEFORE_EVENT), 409);
    const seats = (await getSeats(s.id, BEFORE_EVENT))!;
    expect(seats.seats).toHaveLength(30);
    expect(seats.seats[0]).toEqual({ number: 31, status: "booked" });
    expect(seats.seats[29]).toEqual({ number: 60, status: "available" });
  });

  it("1 nomor HP maksimal 1 tiket aktif per hari", async () => {
    const s = await sessionOf(FRI, 1);
    await book(s.id, 11, "081234567851");
    const hold = await createHold({ sessionId: s.id, queueNumber: 12 }, BEFORE_EVENT);
    await expectAppError(
      // Nomor yang sama dalam format +62 tetap terdeteksi (sudah dinormalisasi di validasi).
      createTicketFromHold({ holdId: hold.id, name: "Budi", phone: "081234567851" }, BEFORE_EVENT),
      409,
    );
    expect(BOOKING_RULES.maxActiveTicketsPerPhonePerDay).toBe(1);
  });
});

describe("hold 5 menit", () => {
  it("hold aktif membuat nomor 'held'; setelah 5 menit kedaluwarsa dan nomor tersedia lagi", async () => {
    const s = await sessionOf(FRI, 1);
    const t0 = BEFORE_EVENT;
    const hold = await createHold({ sessionId: s.id, queueNumber: 15 }, t0);
    expect(new Date(hold.expiresAt).getTime() - t0.getTime()).toBe(5 * 60_000);

    const at = (ms: number) => new Date(t0.getTime() + ms);
    // Menit ke-4:59 → masih terkunci
    expect((await getSeats(s.id, at(299_000)))!.seats[14]).toEqual({ number: 15, status: "held" });
    await expectAppError(createHold({ sessionId: s.id, queueNumber: 15 }, at(299_000)), 409);
    expect(await getHold(hold.id, at(299_000))).not.toBeNull();

    // Menit ke-5:00 → kedaluwarsa
    expect((await getSeats(s.id, at(300_000)))!.seats[14]).toEqual({ number: 15, status: "available" });
    expect(await getHold(hold.id, at(300_000))).toBeNull();
    await expectAppError(
      createTicketFromHold({ holdId: hold.id, name: "Telat", phone: "081234567861" }, at(300_000)),
      409,
    );

    // Orang lain bisa mengambil nomor itu; hold lama dibersihkan otomatis saat request.
    const hold2 = await createHold({ sessionId: s.id, queueNumber: 15 }, at(301_000));
    expect(hold2.id).not.toBe(hold.id);
    expect(await prisma.hold.count()).toBe(1);
  });
});

describe("pembatalan & check-in", () => {
  it("membatalkan tiket membebaskan nomornya dan mengarsipkan data", async () => {
    const s = await sessionOf(FRI, 1);
    const t = await book(s.id, 20, "081234567871");
    await cancelTicket(t.id);
    expect(await prisma.ticket.count()).toBe(0);
    expect(await prisma.cancelledTicket.count({ where: { code: t.code } })).toBe(1);
    expect(await findTicketsByPhone("081234567871")).toHaveLength(0);
    // Nomor & nomor HP bisa dipakai lagi
    const again = await book(s.id, 20, "081234567871");
    expect(again.queueNumber).toBe(20);
  });

  it("check-in: valid → sudah check-in → tidak ditemukan", async () => {
    const s3 = await sessionOf(FRI, 3); // 14:00–14:45
    const t = await book(s3.id, 61, "081234567881");
    const during = wib(FRI, "13:50");

    const ok = await checkInByCode({ code: t.code.toLowerCase() }, during);
    expect(ok.result).toBe("ok");
    expect(ok.ticket.status).toBe("CHECKED_IN");
    expect(ok.ticket.checkedInAt).toBe(during.toISOString());

    const again = await expectAppError(checkInByCode({ code: t.code }, during), 409);
    expect(again.extra?.result).toBe("already");

    const missing = await expectAppError(checkInByCode({ code: "JM-999-AAAA" }, during), 404);
    expect(missing.extra?.result).toBe("not_found");
  });

  it("check-in: salah tanggal / salah sesi ditolak, bisa dipaksa", async () => {
    const s3 = await sessionOf(FRI, 3);
    const t = await book(s3.id, 62, "081234567891");

    const wrongDate = await expectAppError(checkInByCode({ code: t.code }, wib(SAT, "14:10")), 409);
    expect(wrongDate.extra?.result).toBe("wrong_date");

    const tooEarly = await expectAppError(checkInByCode({ code: t.code }, wib(FRI, "10:00")), 409);
    expect(tooEarly.extra?.result).toBe("wrong_session");
    const tooLate = await expectAppError(checkInByCode({ code: t.code }, wib(FRI, "15:00")), 409);
    expect(tooLate.extra?.result).toBe("wrong_session");

    const forced = await checkInByCode({ code: t.code, force: true }, wib(FRI, "15:00"));
    expect(forced.ticket.status).toBe("CHECKED_IN");
  });
});

describe("sekarang dipanggil", () => {
  it("set, baca, dan kosongkan nomor yang dipanggil", async () => {
    expect((await getNowServing(FRI))!.number).toBeNull();
    const v = await setNowServing(FRI, 95);
    expect(v.number).toBe(95);
    expect(v.session).toMatchObject({ order: 4, startTime: "14:45" });
    await expectAppError(setNowServing(FRI, 181), 400);
    await expectAppError(setNowServing("2026-12-01", 1), 404);
    expect((await setNowServing(FRI, 0)).number).toBeNull();
  });
});
