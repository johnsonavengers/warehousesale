import { describe, expect, it } from "vitest";
import { SCHEDULE, SLOT_CAPACITY, buildSeedData, queueRangeForSession } from "@/config/schedule";

/** Tabel dari dokumen spesifikasi (bagian 2) — sumber pembanding. */
const FRIDAY = [
  ["10:00", "10:45", 1, 50],
  ["10:45", "11:30", 51, 100],
  ["14:00", "14:45", 101, 150],
  ["14:45", "15:30", 151, 200],
  ["15:30", "16:15", 201, 250],
  ["16:15", "17:00", 251, 300],
] as const;
const WEEKEND = [
  ["10:15", "11:00", 1, 50],
  ["11:00", "11:45", 51, 100],
  ["11:45", "12:30", 101, 150],
  ["14:00", "14:45", 151, 200],
  ["14:45", "15:30", 201, 250],
  ["15:30", "16:15", 251, 300],
] as const;
const EXPECTED: Record<string, typeof FRIDAY | typeof WEEKEND> = {
  "2026-11-27": FRIDAY,
  "2026-11-28": WEEKEND,
  "2026-11-29": WEEKEND,
  "2026-12-04": FRIDAY,
  "2026-12-05": WEEKEND,
  "2026-12-06": WEEKEND,
  "2026-12-11": FRIDAY,
  "2026-12-12": WEEKEND,
  "2026-12-13": WEEKEND,
};

describe("konfigurasi jadwal", () => {
  it("9 hari × 6 sesi = 54 sesi, 50 nomor per sesi, 2700 tiket", () => {
    const data = buildSeedData();
    expect(data).toHaveLength(9);
    expect(data.flatMap((d) => d.sessions)).toHaveLength(54);
    expect(SLOT_CAPACITY).toBe(50);
    const total = data
      .flatMap((d) => d.sessions)
      .reduce((a, s) => a + (s.queueEnd - s.queueStart + 1), 0);
    expect(total).toBe(2700);
  });

  it.each(Object.keys(EXPECTED))("jam & rentang nomor %s cocok dengan tabel spesifikasi", (date) => {
    const day = buildSeedData().find((d) => d.date === date)!;
    expect(day).toBeDefined();
    expect(
      day.sessions.map((s) => [s.startTime, s.endTime, s.queueStart, s.queueEnd]),
    ).toEqual(EXPECTED[date].map((r) => [...r]));
    expect(day.sessions.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("nomor antrian di-reset tiap tanggal (selalu mulai dari 1, berakhir di 300)", () => {
    for (const day of buildSeedData()) {
      expect(day.sessions[0].queueStart).toBe(1);
      expect(day.sessions[5].queueEnd).toBe(300);
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

  it("queueRangeForSession menghitung (i*50+1)..(i*50+50)", () => {
    expect(queueRangeForSession(0)).toEqual({ queueStart: 1, queueEnd: 50 });
    expect(queueRangeForSession(2)).toEqual({ queueStart: 101, queueEnd: 150 });
    expect(queueRangeForSession(5)).toEqual({ queueStart: 251, queueEnd: 300 });
  });
});
