import { prisma } from "@/lib/prisma";
import { seed } from "../prisma/seed";

/** Kosongkan data transaksi & pastikan jadwal ter-seed. */
export async function resetDb() {
  await prisma.hold.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.cancelledTicket.deleteMany();
  await prisma.nowServing.deleteMany();
  await seed();
}

export async function sessionOf(date: string, order: number) {
  const s = await prisma.session.findFirst({ where: { order, eventDay: { date } } });
  if (!s) throw new Error(`Sesi ${order} pada ${date} tidak ada`);
  return s;
}

/** Waktu WIB → Date. wib("2026-11-27", "09:00") */
export function wib(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+07:00`);
}

export function jsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
