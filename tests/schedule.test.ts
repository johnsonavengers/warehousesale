import { describe, expect, it } from "vitest";
import { SCHEDULE, SLOT_CAPACITY, buildSeedData, queueRangeForSession } from "@/config/schedule";

/** Tabel dari dokumen spesifikasi (bagian 2) — sumber pembanding. */
const FRIDAY = [
  ["10:00", "10:45", 1, 30],
  ["10:45", "11:30", 31, 60],
  ["14:00", "14:45", 61, 90],
  ["14:45", "15:30", 91, 120],
  ["15:30", "16:15", 121, 150],
  ["16:15", "17:00", 151, 180],
] as const;
const WEEKEND = [
  ["10:15", "11:00", 1, 30],
  ["11:00", "11:45", 31, 60],
  ["11:45", "12:30", 61, 90],
  ["14:00", "14:45", 91, 120],
  ["14:45", "15:30", 121, 150],
  ["15:30", "16:15", 151, 180],
] as const;
const EXPECTED: Record<string, typeof FRIDAY | typeof WEEKEND> = {
  "2026-11-27": FRIDAY,
  "2026-11-28": WEEKEND,
  "2026-11-29": WEEKEND,
};

describe("konfigurasi jadwal", () => {
  it("3 hari × 6 sesi = 18 sesi, 30 nomor per sesi, 540 tiket", () => {
    const data = buildSeedData();
    expect(data).toHaveLength(3);
    expect(data.flatMap((d) => d.sessions)).toHaveLength(18);
    expect(SLOT_CAPACITY).toBe(30);
    const total = data
      .flatMap((d) => d.sessions)
      .reduce((a, s) => a + (s.queueEnd - s.queueStart + 1), 0);
    expect(total).toBe(540);
  });

  it.each(Object.keys(EXPECTED))("jam & rentang nomor %s cocok dengan tabel spesifikasi", (date) => {
    const day = buildSeedData().find((d) => d.date === date)!;
    expect(day).toBeDefined();
    expect(
      day.sessions.map((s) => [s.startTime, s.endTime, s.queueStart, s.queueEnd]),
    ).toEqual(EXPECTED[date].map((r) => [...r]));
    expect(day.sessions.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("nomor antrian di-reset tiap tanggal (selalu mulai dari 1, berakhir di 180)", () => {
    for (const day of buildSeedData()) {
      expect(day.sessions[0].queueStart).toBe(1);
      expect(day.sessions[5].queueEnd).toBe(180);
    }
  });

  it("istirahat: Jumat 11:30–14:00, Sabtu & Minggu 12:30–14:00", () => {
    const breaks = Object.fromEntries(SCHEDULE.map((d) => [d.date, d.breaks]));
    expect(breaks["2026-11-27"]).toEqual([{ start: "11:30", end: "14:00" }]);
    expect(breaks["2026-11-28"]).toEqual([{ start: "12:30", end: "14:00" }]);
    expect(breaks["2026-11-29"]).toEqual([{ start: "12:30", end: "14:00" }]);
  });

  it("tidak ada sesi yang tumpang tindih dengan istirahat", () => {
    for (const day of SCHEDULE) {
      for (const b of day.breaks) {
        for (const s of day.sessions) {
          expect(s.end <= b.start || s.start >= b.end).toBe(true);
        }
      }
    }
  });

  it("queueRangeForSession menghitung (i*30+1)..(i*30+30)", () => {
    expect(queueRangeForSession(0)).toEqual({ queueStart: 1, queueEnd: 30 });
    expect(queueRangeForSession(2)).toEqual({ queueStart: 61, queueEnd: 90 });
    expect(queueRangeForSession(5)).toEqual({ queueStart: 151, queueEnd: 180 });
  });
});
