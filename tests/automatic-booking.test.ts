import { beforeEach, describe, expect, it } from "vitest";
import { createAutomaticTicket, cancelTicket, createHold } from "@/lib/booking";
import { prisma } from "@/lib/prisma";
import { resetDb, sessionOf, wib } from "./helpers";
const FRI = "2026-11-27";
const before = wib("2026-11-20", "09:00");
async function book(order = 3, phone = "081200000001", date = FRI, now = before) {
  const session = await sessionOf(date, order);
  return createAutomaticTicket({ date, sessionId: session.id, phone, name: "Pemesan Test" }, now);
}
async function fillSession(order: number, empty: number[] = []) {
  const s = await sessionOf(FRI, order);
  await prisma.ticket.createMany({ data: Array.from({ length: 50 }, (_, i) => ({
    code: `FULL-${s.order}-${i}`, date: FRI, sessionId: s.id,
    queueNumber: s.queueStart + i, name: "Sudah pesan", phone: `08129999${String(s.queueStart + i).padStart(4, "0")}`,
  })).filter(t => !empty.includes(t.queueNumber)) });
}
beforeEach(resetDb);
describe("pilihan jam dan alokasi nomor otomatis", () => {
  it("setiap sesi yang dipilih menghasilkan jam yang sama dan nomor dalam rentangnya", async () => {
    for (let order = 1; order <= 6; order++) {
      const ticket = await book(order, `08120000000${order}`);
      const session = await sessionOf(FRI, order);
      expect(ticket.session).toMatchObject({ id: session.id, order, startTime: session.startTime, endTime: session.endTime });
      expect(ticket.queueNumber).toBeGreaterThanOrEqual(session.queueStart);
      expect(ticket.queueNumber).toBeLessThanOrEqual(session.queueEnd);
    }
  });
  it("jam penuh ditolak dan tidak dialihkan ke sesi lain yang masih kosong", async () => {
    await fillSession(3);
    await expect(book(3)).rejects.toMatchObject({ status: 409, message: expect.stringContaining("jam yang dipilih sudah penuh") });
    expect((await book(4)).session.order).toBe(4);
    expect(await prisma.ticket.count()).toBe(51);
  });
  it("slot terakhir hanya dapat diambil sekali, meskipun sesi lain masih kosong", async () => {
    await fillSession(3, [149]);
    expect((await book(3)).queueNumber).toBe(149);
    await expect(book(3, "081200000002")).rejects.toMatchObject({ status: 409 });
    expect(await prisma.ticket.count()).toBe(50);
  });
  it("tanggal lain menerima WhatsApp sama, tetapi sesi lain di tanggal sama tidak", async () => {
    for (const date of [FRI, "2026-12-04", "2026-12-13"]) expect((await book(3, undefined, date)).date).toBe(date);
    await expect(book(4)).rejects.toMatchObject({ status: 409, message: expect.stringContaining("WhatsApp") });
    expect(await prisma.ticket.count()).toBe(3);
  });
  it("sesi yang telah dimulai ditolak tepat pada batas waktu", async () => {
    await expect(book(3, undefined, FRI, wib(FRI, "14:00"))).rejects.toMatchObject({ status: 409 });
    await expect(book(1, undefined, FRI, wib(FRI, "11:30"))).rejects.toMatchObject({ status: 409 });
    expect((await book(3, undefined, FRI, wib(FRI, "13:59"))).session.startTime).toBe("14:00");
  });
  it("sesi dari tanggal lain dan sesi tidak dikenal ditolak", async () => {
    const other = await sessionOf("2026-11-28", 1);
    for (const sessionId of [other.id, "missing", ""]) await expect(createAutomaticTicket({ date: FRI, sessionId, name: "Test User", phone: "081200000001" }, before)).rejects.toMatchObject({ status: 404 });
    expect(await prisma.ticket.count()).toBe(0);
  });
  it("tanggal lewat tetap ditolak", async () => {
    await expect(book(6, undefined, FRI, wib("2026-11-28", "09:00"))).rejects.toMatchObject({ status: 409 });
  });
  it("pembatalan membebaskan nomor pada sesi yang sama", async () => {
    await fillSession(2, [73]);
    const first = await book(2); await cancelTicket(first.id);
    expect((await book(2, "081200000003")).queueNumber).toBe(73);
    expect(await prisma.ticket.count()).toBe(50);
  });
  it("hold lama dihormati sampai kedaluwarsa", async () => {
    await fillSession(1, [1, 2]);
    const s = await sessionOf(FRI, 1);
    await createHold({ sessionId: s.id, queueNumber: 1 }, before);
    expect((await book(1)).queueNumber).toBe(2);
    await expect(book(1, "081200000002")).rejects.toMatchObject({ status: 409 });
    expect((await book(1, "081200000002", FRI, new Date(before.getTime() + 6 * 60_000))).queueNumber).toBe(1);
  });
  it("constraint database tetap menolak nomor ganda", async () => {
    const ticket = await book();
    await expect(prisma.ticket.create({ data: { code: "DIFFERENT", date: FRI, sessionId: ticket.session.id, queueNumber: ticket.queueNumber, name: "Duplikat", phone: "081200000002" } })).rejects.toMatchObject({ code: "P2002" });
  });
});
