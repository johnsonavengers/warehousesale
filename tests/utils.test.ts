import { afterEach, describe, expect, it } from "vitest";
import { maskPhone, normalizePhone, toWhatsAppNumber } from "@/lib/phone";
import {
  CODE_ALPHABET,
  TICKET_CODE_REGEX,
  dayPrefix,
  generateTicketCode,
  normalizeTicketCode,
} from "@/lib/ticket-code";
import {
  eventDateTime,
  getNow,
  isBookingClosed,
  isDayPast,
  timeInEventTz,
  todayInEventTz,
} from "@/lib/time";

describe("util waktu (Asia/Jakarta)", () => {
  it("eventDateTime mengubah jam WIB ke UTC (WIB = UTC+7)", () => {
    expect(eventDateTime("2026-11-27", "10:00").toISOString()).toBe("2026-11-27T03:00:00.000Z");
    expect(eventDateTime("2026-11-28", "00:30").toISOString()).toBe("2026-11-27T17:30:00.000Z");
  });

  it("todayInEventTz memakai zona event, bukan zona server", () => {
    // 26 Nov 18:00 UTC = 27 Nov 01:00 WIB
    const now = new Date("2026-11-26T18:00:00Z");
    expect(todayInEventTz(now)).toBe("2026-11-27");
    expect(timeInEventTz(now)).toBe("01:00");
  });

  it("isDayPast baru true setelah tengah malam WIB", () => {
    expect(isDayPast("2026-11-27", new Date("2026-11-27T16:59:00Z"))).toBe(false); // 23:59 WIB
    expect(isDayPast("2026-11-27", new Date("2026-11-27T17:00:00Z"))).toBe(true); // 00:00 WIB (28 Nov)
    expect(isDayPast("2026-11-27", new Date("2026-11-20T00:00:00Z"))).toBe(false);
  });

  it("isBookingClosed: tutup tepat saat sesi mulai (default), bisa diatur cut-off", () => {
    const before = new Date("2026-11-27T02:59:59Z"); // 09:59:59 WIB
    const atStart = new Date("2026-11-27T03:00:00Z"); // 10:00 WIB
    expect(isBookingClosed("2026-11-27", "10:00", before)).toBe(false);
    expect(isBookingClosed("2026-11-27", "10:00", atStart)).toBe(true);
    // cut-off 15 menit → 09:50 WIB sudah tutup
    expect(isBookingClosed("2026-11-27", "10:00", new Date("2026-11-27T02:50:00Z"), 15)).toBe(true);
    expect(isBookingClosed("2026-11-27", "10:00", new Date("2026-11-27T02:40:00Z"), 15)).toBe(false);
  });

  describe("getNow", () => {
    afterEach(() => {
      process.env.TEST_NOW = "";
    });
    it("memakai TEST_NOW bila di-set", () => {
      process.env.TEST_NOW = "2026-11-27T13:40:00+07:00";
      expect(getNow().toISOString()).toBe("2026-11-27T06:40:00.000Z");
    });
    it("memakai waktu sistem bila TEST_NOW kosong", () => {
      expect(Math.abs(getNow().getTime() - Date.now())).toBeLessThan(2000);
    });
  });
});

describe("kode tiket", () => {
  it("awalan hari: JM (Jumat), SB (Sabtu), MG (Minggu)", () => {
    expect(dayPrefix("2026-11-27")).toBe("JM");
    expect(dayPrefix("2026-11-28")).toBe("SB");
    expect(dayPrefix("2026-11-29")).toBe("MG");
  });

  it("format XX-NNN-XXXX, mis. JM-027-X7K2", () => {
    const code = generateTicketCode("2026-11-27", 27);
    expect(code).toMatch(/^JM-027-[A-Z2-9]{4}$/);
    expect(code).toMatch(TICKET_CODE_REGEX);
    expect(generateTicketCode("2026-11-29", 180)).toMatch(/^MG-180-/);
  });

  it("tidak memakai karakter ambigu 0/O/1/I/L", () => {
    expect(CODE_ALPHABET).not.toMatch(/[0O1IL]/);
    for (let i = 0; i < 500; i++) {
      const suffix = generateTicketCode("2026-11-27", 5).split("-")[2];
      expect(suffix).not.toMatch(/[0O1IL]/);
    }
  });

  it("cukup acak: 300 kode untuk nomor yang sama hampir semuanya unik", () => {
    const set = new Set(Array.from({ length: 300 }, () => generateTicketCode("2026-11-27", 1)));
    expect(set.size).toBeGreaterThan(290);
  });

  it("normalizeTicketCode merapikan input scan/manual", () => {
    expect(normalizeTicketCode("  jm-027-x7k2 ")).toBe("JM-027-X7K2");
    expect(normalizeTicketCode("https://contoh.id/ticket/JM-027-X7K2?baru=1")).toBe("JM-027-X7K2");
  });
});

describe("nomor HP Indonesia", () => {
  it("menerima 08xx, 628xx, +628xx dan menormalkan ke 08xx", () => {
    expect(normalizePhone("081234567890")).toBe("081234567890");
    expect(normalizePhone("+62 812-3456-7890")).toBe("081234567890");
    expect(normalizePhone("6281234567890")).toBe("081234567890");
  });
  it("menolak format yang salah", () => {
    for (const bad of ["", "12345", "0212345678", "08123", "+6581234567", "08abc1234567", "080123456789"]) {
      expect(normalizePhone(bad)).toBeNull();
    }
  });
  it("maskPhone menyamarkan bagian tengah", () => {
    expect(maskPhone("081234567890")).toBe("0812••••7890");
  });
  it("toWhatsAppNumber → 628xx", () => {
    expect(toWhatsAppNumber("081234567890")).toBe("6281234567890");
  });
});
