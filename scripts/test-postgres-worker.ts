import { seed } from "../prisma/seed";
import { createAutomaticTicket } from "../src/lib/booking";
import { prisma } from "../src/lib/prisma";

async function main() {
  const schema = new URL(process.env.DATABASE_URL ?? "").searchParams.get("schema");
  if (!schema || !/^whs_test_[a-f0-9]{32}$/.test(schema)) {
    throw new Error("Worker hanya boleh memakai schema sementara pengujian.");
  }
  if (process.argv[2] === "seed") return seed();
  const phones: string[] = JSON.parse(process.argv[3]);
  return Promise.all(phones.map(async (phone) => {
    try {
      const ticket = await createAutomaticTicket({ date: "2026-11-27", name: "Uji konkurensi", phone });
      return { status: 201, number: ticket.queueNumber, code: ticket.code, session: ticket.session.order };
    } catch (error) {
      return { status: (error as { status?: number }).status ?? 500 };
    }
  }));
}
main().then((data) => process.send?.({ ok: true, data }))
  .catch((error) => { process.send?.({ ok: false, error: `Pengujian gagal: ${error.code ?? error.name}` }); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); process.disconnect?.(); });
