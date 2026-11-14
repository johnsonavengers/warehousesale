import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { EVENT_TZ } from "@/config/schedule";

/**
 * Waktu "sekarang". Env TEST_NOW (ISO 8601) bisa dipakai untuk membekukan waktu
 * saat pengujian (mis. E2E) — JANGAN di-set di production.
 */
export function getNow(): Date {
  const fake = process.env.TEST_NOW;
  if (fake) {
    const d = new Date(fake);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

/** Ubah tanggal "YYYY-MM-DD" + jam "HH:mm" di zona waktu event menjadi Date (UTC instant). */
export function eventDateTime(date: string, time: string): Date {
  return fromZonedTime(`${date}T${time}:00`, EVENT_TZ);
}

/** Tanggal hari ini ("YYYY-MM-DD") menurut zona waktu event, bukan zona server. */
export function todayInEventTz(now: Date = getNow()): string {
  return formatInTimeZone(now, EVENT_TZ, "yyyy-MM-dd");
}

/** Jam sekarang ("HH:mm") menurut zona waktu event. */
export function timeInEventTz(now: Date = getNow()): string {
  return formatInTimeZone(now, EVENT_TZ, "HH:mm");
}

/** Tanggal event sudah lewat (hari kalender di zona event sudah berganti). */
export function isDayPast(date: string, now: Date = getNow()): boolean {
  return todayInEventTz(now) > date;
}

/** Pemesanan sesi sudah ditutup: now >= jam mulai − cutoff. */
export function isBookingClosed(
  date: string,
  startTime: string,
  now: Date = getNow(),
  cutoffMinutes = 0,
): boolean {
  const start = eventDateTime(date, startTime).getTime();
  return now.getTime() >= start - cutoffMinutes * 60_000;
}

export function isValidDateString(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Format waktu (mis. waktu check-in) untuk ditampilkan dalam WIB. */
export function formatEventDateTime(d: Date): string {
  return formatInTimeZone(d, EVENT_TZ, "dd/MM/yyyy HH:mm") + " WIB";
}
