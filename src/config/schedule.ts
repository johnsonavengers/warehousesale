/**
 * SUMBER KEBENARAN JADWAL.
 * Ubah jadwal cukup di file ini, lalu jalankan ulang `npm run seed`.
 * Nomor antrian dihitung otomatis: sesi ke-i (0-based) → (i*30 + 1) s/d (i*30 + 30),
 * dan di-reset tiap tanggal.
 */
export const EVENT_TZ = "Asia/Jakarta";
export const SLOT_CAPACITY = 30;

export type TimeRange = { start: string; end: string };
export type ScheduleDay = {
  date: string; // "YYYY-MM-DD"
  label: string;
  sessions: TimeRange[];
  breaks: TimeRange[];
};

const WEEKEND_SESSIONS: TimeRange[] = [
  { start: "10:15", end: "11:00" },
  { start: "11:00", end: "11:45" },
  { start: "11:45", end: "12:30" },
  { start: "14:00", end: "14:45" },
  { start: "14:45", end: "15:30" },
  { start: "15:30", end: "16:15" },
];
const WEEKEND_BREAKS: TimeRange[] = [{ start: "12:30", end: "14:00" }];

export const SCHEDULE: ScheduleDay[] = [
  {
    date: "2026-11-27",
    label: "Jumat, 27 Nov",
    sessions: [
      { start: "10:00", end: "10:45" },
      { start: "10:45", end: "11:30" },
      { start: "14:00", end: "14:45" },
      { start: "14:45", end: "15:30" },
      { start: "15:30", end: "16:15" },
      { start: "16:15", end: "17:00" },
    ],
    breaks: [{ start: "11:30", end: "14:00" }],
  },
  {
    date: "2026-11-28",
    label: "Sabtu, 28 Nov",
    sessions: WEEKEND_SESSIONS,
    breaks: WEEKEND_BREAKS,
  },
  {
    date: "2026-11-29",
    label: "Minggu, 29 Nov",
    sessions: WEEKEND_SESSIONS,
    breaks: WEEKEND_BREAKS,
  },
];

/** Rentang nomor antrian untuk sesi ke-`index` (0-based). */
export function queueRangeForSession(index: number): { queueStart: number; queueEnd: number } {
  return {
    queueStart: index * SLOT_CAPACITY + 1,
    queueEnd: index * SLOT_CAPACITY + SLOT_CAPACITY,
  };
}

export function getScheduleDay(date: string): ScheduleDay | undefined {
  return SCHEDULE.find((d) => d.date === date);
}

/** Bentuk baris yang di-seed ke database (dipakai seed & unit test). */
export function buildSeedData() {
  return SCHEDULE.map((day) => ({
    date: day.date,
    label: day.label,
    sessions: day.sessions.map((s, i) => ({
      order: i + 1,
      startTime: s.start,
      endTime: s.end,
      ...queueRangeForSession(i),
    })),
  }));
}
