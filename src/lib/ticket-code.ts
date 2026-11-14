import { randomInt } from "node:crypto";

/** Alfabet tanpa karakter ambigu (tanpa 0/O, 1/I/L). */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const DAY_PREFIX = ["MG", "SN", "SL", "RB", "KM", "JM", "SB"]; // Minggu..Sabtu

/** Awalan 2 huruf dari hari (JM = Jumat, SB = Sabtu, MG = Minggu, ...). */
export function dayPrefix(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  // Hari dalam minggu dari tanggal kalender; tidak bergantung zona waktu.
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return DAY_PREFIX[dow];
}

export function randomSuffix(length = 4): string {
  let out = "";
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}

/** Contoh: generateTicketCode("2026-11-27", 27) → "JM-027-X7K2" */
export function generateTicketCode(date: string, queueNumber: number): string {
  return `${dayPrefix(date)}-${String(queueNumber).padStart(3, "0")}-${randomSuffix(4)}`;
}

export const TICKET_CODE_REGEX = new RegExp(`^[A-Z]{2}-\\d{3}-[${CODE_ALPHABET}]{4}$`);

/** Rapikan input kode (dari scan/ketik manual): trim, huruf besar, ambil dari URL bila perlu. */
export function normalizeTicketCode(input: string): string {
  let s = input.trim();
  const m = s.match(/\/ticket\/([^/?#]+)/i);
  if (m) s = decodeURIComponent(m[1]);
  return s.toUpperCase().replace(/\s+/g, "");
}
