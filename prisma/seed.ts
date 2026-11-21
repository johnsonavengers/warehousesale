/**
 * Seed jadwal dalam transaksi per tanggal. Mengikuti kunci yang sama dengan booking,
 * agar pemesanan tidak membaca rentang sesi yang baru diperbarui sebagian.
 */
import "dotenv/config";
import { buildSeedData } from "../src/config/schedule";
import { prisma } from "../src/lib/prisma";

export async function seed() {
  const data = buildSeedData();
  let sessionCount = 0;
  for (const day of data) {
    await prisma.$transaction(async (tx) => {
      const eventDay = await tx.eventDay.upsert({
        where: { date: day.date },
        create: { date: day.date, label: day.label },
        update: { label: day.label, bookingRevision: { increment: 1 } },
      });
      const existing = await tx.session.findMany({ where: { eventDayId: eventDay.id } });
      const tickets = await tx.ticket.findMany({
        where: { date: day.date }, select: { sessionId: true, queueNumber: true },
      });
      const holds = await tx.hold.findMany({
        where: { date: day.date, expiresAt: { gt: new Date() } },
        select: { sessionId: true, queueNumber: true },
      });
      for (const booking of [...tickets, ...holds]) {
        const order = existing.find((s) => s.id === booking.sessionId)?.order;
        const target = day.sessions.find((s) => s.order === order);
        if (!target || booking.queueNumber < target.queueStart || booking.queueNumber > target.queueEnd) {
          throw new Error(`Jadwal ${day.date} tidak diubah: terdapat tiket atau reservasi aktif di luar rentang baru. Tiket yang sudah terbit harus tetap dipertahankan.`);
        }
      }
      for (const s of day.sessions) {
        await tx.session.upsert({
          where: { eventDayId_order: { eventDayId: eventDay.id, order: s.order } },
          create: { eventDayId: eventDay.id, ...s },
          update: {
            startTime: s.startTime,
            endTime: s.endTime,
            queueStart: s.queueStart,
            queueEnd: s.queueEnd,
          },
        });
      }
      await tx.session.deleteMany({
        where: {
          eventDayId: eventDay.id, order: { gt: day.sessions.length },
          tickets: { none: {} }, holds: { none: {} },
        },
      });
    }, { maxWait: 15_000, timeout: 20_000 });
    sessionCount += day.sessions.length;
  }
  return { days: data.length, sessions: sessionCount };
}

if (process.argv[1] && /seed\.(ts|js|mjs)$/.test(process.argv[1])) {
  seed()
    .then((r) => console.log(`Seed selesai: ${r.days} hari, ${r.sessions} sesi.`))
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
