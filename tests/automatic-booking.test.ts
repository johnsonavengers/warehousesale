import { beforeEach, describe, expect, it } from "vitest";
import { createAutomaticTicket, cancelTicket, createHold } from "@/lib/booking";
import { prisma } from "@/lib/prisma";
import { resetDb, sessionOf, wib } from "./helpers";
const FRI = "2026-11-27";
const before = wib("2026-11-20", "09:00");
const book = (phone = "081200000001", date = FRI, now = before) => createAutomaticTicket({ date, phone, name: "Pemesan Test" }, now);
beforeEach(resetDb);
describe("alokasi sesi dan nomor otomatis", () => {
  it("melewati sesi yang sudah dimulai dan jam istirahat", async () => {
    const ticket = await book(undefined, FRI, wib(FRI, "11:30"));
    expect(ticket.queueNumber).toBe(61);
    expect(ticket.session.order).toBe(3);
    expect(ticket.session.startTime).toBe("14:00");
  });
  it("sesi penuh beralih otomatis ke sesi berikutnya", async () => {
    const s = await sessionOf(FRI, 1);
    await prisma.ticket.createMany({ data: Array.from({ length: 30 }, (_, i) => ({ code: `TEST-${i}`, date: FRI, sessionId: s.id, queueNumber: i + 1, name: "Sudah pesan", phone: `08121111${String(i).padStart(4, "0")}` })) });
    const ticket = await book();
    expect(ticket.queueNumber).toBe(31);
    expect(ticket.session.order).toBe(2);
  });
  it("memesan slot terakhir lalu menolak saat semua kuota penuh", async () => {
    const sessions = await prisma.session.findMany({ where: { eventDay: { date: FRI } } });
    await prisma.ticket.createMany({ data: sessions.flatMap((s) => Array.from({ length: 30 }, (_, i) => ({ code: `FULL-${s.order}-${i}`, date: FRI, sessionId: s.id, queueNumber: s.queueStart + i, name: "Penuh", phone: `08120000${s.queueStart + i}` }))).filter((t) => t.queueNumber < 180) });
    expect((await book()).queueNumber).toBe(180);
    await expect(book("081200000002")).rejects.toMatchObject({ status: 409, message: expect.stringContaining("penuh") });
    expect(await prisma.ticket.count()).toBe(180);
  });
  it("nomor dimulai lagi dari 1 di tanggal lain, WhatsApp sama diperbolehkan", async () => {
    expect((await book()).queueNumber).toBe(1);
    expect((await book(undefined, "2026-12-04")).queueNumber).toBe(1);
    expect((await book(undefined, "2026-12-13")).queueNumber).toBe(1);
  });
  it("tanggal lewat dan sesi terakhir yang sudah mulai ditolak", async () => {
    for (const now of [wib(FRI, "16:15"), wib("2026-11-28", "09:00")]) {
      await expect(book(undefined, FRI, now)).rejects.toMatchObject({ status: 409 });
    }
    expect(await prisma.ticket.count()).toBe(0);
  });
  it("nomor pembatalan dapat digunakan kembali tanpa menduplikasi tiket aktif", async () => {
    const first = await book();
    await book("081200000002");
    await cancelTicket(first.id);
    expect((await book("081200000003")).queueNumber).toBe(1);
    expect(await prisma.ticket.count()).toBe(2);
  });
  it("menghormati hold lama yang belum kedaluwarsa", async () => {
    const s = await sessionOf(FRI, 1);
    await createHold({ sessionId: s.id, queueNumber: 1 }, before);
    expect((await book()).queueNumber).toBe(2);
    expect((await book("081200000002", FRI, new Date(before.getTime() + 6 * 60_000))).queueNumber).toBe(1);
  });
  it("constraint database menolak nomor ganda walau insert langsung", async () => {
    const ticket = await book();
    await expect(prisma.ticket.create({ data: { code: "DIFFERENT", date: FRI, sessionId: ticket.session.id, queueNumber: ticket.queueNumber, name: "Duplikat", phone: "081200000002" } })).rejects.toMatchObject({ code: "P2002" });
  });
});
