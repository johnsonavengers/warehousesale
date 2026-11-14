/**
 * Seed: membangun EventDay & Session dari src/config/schedule.ts.
 * Aman dijalankan berulang (upsert). Sesi yang sudah punya tiket tidak dihapus.
 */
import "dotenv/config";
import { buildSeedData } from "../src/config/schedule";
import { prisma } from "../src/lib/prisma";

export async function seed() {
  const data = buildSeedData();
  let sessionCount = 0;
  for (const day of data) {
    const eventDay = await prisma.eventDay.upsert({
      where: { date: day.date },
      create: { date: day.date, label: day.label },
      update: { label: day.label },
    });
    for (const s of day.sessions) {
      await prisma.session.upsert({
        where: { eventDayId_order: { eventDayId: eventDay.id, order: s.order } },
        create: { eventDayId: eventDay.id, ...s },
        update: {
          startTime: s.startTime,
          endTime: s.endTime,
          queueStart: s.queueStart,
          queueEnd: s.queueEnd,
        },
      });
      sessionCount++;
    }
    // Hapus sesi yang sudah tidak ada di config (hanya jika belum punya tiket/hold).
    await prisma.session.deleteMany({
      where: {
        eventDayId: eventDay.id,
        order: { gt: day.sessions.length },
        tickets: { none: {} },
        holds: { none: {} },
      },
    });
  }
  return { days: data.length, sessions: sessionCount };
}

if (process.argv[1] && /seed\.(ts|js|mjs)$/.test(process.argv[1])) {
  seed()
    .then((r) => console.log(`Seed selesai: ${r.days} hari, ${r.sessions} sesi.`))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
