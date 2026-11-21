import { describe, expect, it, vi } from "vitest";
import { pickRandomAvailableSlot } from "@/lib/random-slot";

const sessions = [
  { id: "morning", queueStart: 1, queueEnd: 3 },
  { id: "afternoon", queueStart: 31, queueEnd: 33 },
];
describe("pengacakan sesi dan nomor kosong", () => {
  it("dapat memilih sesi kedua dan nomor terakhir, bukan selalu urutan pertama", () => {
    const choose = vi.fn().mockReturnValueOnce(1).mockReturnValueOnce(2);
    expect(pickRandomAvailableSlot(sessions, new Set(), choose)).toEqual({ sessionId: "afternoon", queueNumber: 33 });
    expect(choose.mock.calls).toEqual([[2], [3]]);
  });
  it("setiap sesi dan setiap nomor kosong dapat terpilih", () => {
    for (let index = 0; index < sessions.length; index++) {
      const session = sessions[index];
      for (let number = 0; number < 3; number++) {
        const choose = vi.fn().mockReturnValueOnce(index).mockReturnValueOnce(number);
        expect(pickRandomAvailableSlot(sessions, new Set(), choose)).toEqual({ sessionId: session.id, queueNumber: session.queueStart + number });
      }
    }
  });
  it("mengeluarkan sesi penuh dan nomor terpakai dari pengacakan", () => {
    const choose = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(1);
    expect(pickRandomAvailableSlot(sessions, new Set([1, 2, 3, 32]), choose)).toEqual({ sessionId: "afternoon", queueNumber: 33 });
    expect(choose.mock.calls).toEqual([[1], [2]]);
  });
  it("tidak memanggil pengacak bila semua kuota penuh atau tidak ada sesi", () => {
    const choose = vi.fn();
    expect(pickRandomAvailableSlot(sessions, new Set([1, 2, 3, 31, 32, 33]), choose)).toBeNull();
    expect(pickRandomAvailableSlot([], new Set(), choose)).toBeNull();
    expect(choose).not.toHaveBeenCalled();
  });
});
