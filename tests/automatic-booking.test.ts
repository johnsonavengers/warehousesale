import { beforeEach, describe, expect, it } from "vitest";
import { createAutomaticTicket, cancelTicket, createHold } from "@/lib/booking";
import { prisma } from "@/lib/prisma";
import { resetDb, sessionOf, wib } from "./helpers";
const FRI = "2026-11-27";
const before = wib("2026-11-20", "09:00");
const book = (phone = "081200000001", date = FRI, now = before) => createAutomaticTicket({ date, phone, name: "Pemesan Test" }, now);

async function fillExcept(empty: number[]) {
  const sessions = await prisma.session.findMany({ where: { eventDay: { date: FRI } } });
  await prisma.ticket.createMany({
    data: sessions.flatMap((s) => Array.from({ length: 50 }, (_, i) => ({
      code: `FULL-${s.order}-${i}`, date: FRI, sessionId: s.id,
      queueNumber: s.queueStart + i, name: "Sudah pesan", phone: `08129999${String(s.queueStart + i).padStart(4, "0")}`,
    }))).filter((t) => !empty.includes(t.queueNumber)),
  });
}

beforeEach(resetDb);
describe("alokasi sesi dan nomor acak otomatis", () => {
  it("hanya mengacak sesi yang belum mulai, melewati waktu istirahat", async () => {
    const ticket = await book(undefined, FRI, wib(FRI, "11:30"));
    expect(ticket.queueNumber).toBeGreaterThanOrEqual(101);
    expect(ticket.queueNumber).toBeLessThanOrEqual(300);
    expect(ticket.session.order).toBe(Math.floor((ticket.queueNumber - 1) / 50) + 1);
    expect(ticket.session.startTime >= "14:00").toBe(true);
  });
  it("sesi penuh tidak ikut pengacakan", async () => {
    const s = await sessionOf(FRI, 1);
    await prisma.ticket.createMany({ data: Array.from({ length: 50 }, (_, i) => ({ code: `TEST-${i}`, date: FRI, sessionId: s.id, queueNumber: i + 1, name: "Sudah pesan", phone: `08121111${String(i).padStart(4, "0")}` })) });
    const ticket = await book();
    expect(ticket.queueNumber).toBeGreaterThanOrEqual(51);
    expect(ticket.session.order).toBeGreaterThanOrEqual(2);
  });
  it("memesan slot terakhir lalu menolak saat semua kuota penuh", async () => {
    await fillExcept([300]);
    expect((await book()).queueNumber).toBe(300);
    await expect(book("081200000002")).rejects.toMatchObject({ status: 409, message: expect.stringContaining("penuh") });
    expect(await prisma.ticket.count()).toBe(300);
  });
  it("tanggal lain mempunyai kuota sendiri dan menerima WhatsApp yang sama", async () => {
    for (const date of [FRI, "2026-12-04", "2026-12-13"]) {
      const ticket = await book(undefined, date);
      expect(ticket.date).toBe(date);
      expect(ticket.queueNumber).toBeGreaterThanOrEqual(1);
      expect(ticket.queueNumber).toBeLessThanOrEqual(300);
    }
    expect(await prisma.ticket.count()).toBe(3);
  });
  it("tanggal lewat dan sesi terakhir yang sudah mulai ditolak", async () => {
    for (const now of [wib(FRI, "16:15"), wib("2026-11-28", "09:00")]) {
      await expect(book(undefined, FRI, now)).rejects.toMatchObject({ status: 409 });
    }
    expect(await prisma.ticket.count()).toBe(0);
  });
  it("nomor pembatalan masuk kembali ke kuota kosong tanpa duplikasi", async () => {
    await fillExcept([73]);
    const first = await book();
    await cancelTicket(first.id);
    expect((await book("081200000003")).queueNumber).toBe(73);
    expect(await prisma.ticket.count()).toBe(300);
  });
  it("hold lama tidak ikut pengacakan sampai kedaluwarsa", async () => {
    await fillExcept([1, 2]);
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
