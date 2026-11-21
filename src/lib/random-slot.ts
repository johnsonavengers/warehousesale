import { randomInt } from "node:crypto";

type SessionRange = { id: string; queueStart: number; queueEnd: number };

/** Sesi dipilih acak, lalu satu nomor kosong dalam sesi tersebut dipilih acak. */
export function pickRandomAvailableSlot(
  sessions: SessionRange[],
  taken: ReadonlySet<number>,
  chooseIndex: (length: number) => number = randomInt,
): { sessionId: string; queueNumber: number } | null {
  const available = sessions.map((session) => ({
    sessionId: session.id,
    numbers: Array.from(
      { length: session.queueEnd - session.queueStart + 1 },
      (_, index) => session.queueStart + index,
    ).filter((number) => !taken.has(number)),
  })).filter((session) => session.numbers.length > 0);

  if (!available.length) return null;
  const session = available[chooseIndex(available.length)];
  return {
    sessionId: session.sessionId,
    queueNumber: session.numbers[chooseIndex(session.numbers.length)],
  };
}
