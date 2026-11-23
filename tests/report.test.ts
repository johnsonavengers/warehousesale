import { beforeEach, describe, expect, it } from "vitest";
import { Workbook, ValueType } from "exceljs";
import { createAutomaticTicket, cancelTicket, updateTicketStatus } from "@/lib/booking";
import { ADMIN_COOKIE, expectedAdminToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRegistrationReport, parseReportFilter, summarizeRegistrations } from "@/lib/registration-report";
import { buildRegistrationWorkbook } from "@/lib/report-excel";
import { GET as exportExcel } from "@/app/api/admin/reports/export/route";
import { resetDb, wib, sessionOf } from "./helpers";

const FRI = "2026-11-27";
const SAT = "2026-11-28";
const now = wib("2026-11-21", "09:00");
beforeEach(resetDb);

async function fixtures() {
  const checked = await createAutomaticTicket({ date: FRI, sessionId: (await sessionOf(FRI, 3)).id, name: "=2+3", phone: "081234560001", email: "first@example.test" }, now);
  const booked = await createAutomaticTicket({ date: SAT, sessionId: (await sessionOf(SAT, 3)).id, name: "Siti Aminah", phone: "081234560001" }, now);
  const cancelled = await createAutomaticTicket({ date: FRI, sessionId: (await sessionOf(FRI, 3)).id, name: "Budi Batal", phone: "081234560002", email: "cancel@example.test" }, now);
  await updateTicketStatus(checked.id, "CHECKED_IN", wib(FRI, "14:05"));
  await prisma.ticket.update({ where: { id: checked.id }, data: { createdAt: new Date("2026-11-21T10:00:00Z") } });
  await cancelTicket(cancelled.id);
  return { checked, booked, cancelled };
}

async function request(query = "", token = true) {
  return exportExcel(new Request(`http://localhost/api/admin/reports/export${query}`, {
    headers: token ? { cookie: `${ADMIN_COOKIE}=${await expectedAdminToken()}` } : {},
  }));
}

describe("laporan pendaftaran", () => {
  it("merangkum tiket aktif, check-in, pembatalan dan pengunjung unik", async () => {
    const data = await fixtures();
    const rows = await getRegistrationReport();
    expect(summarizeRegistrations(rows)).toEqual({ total: 3, uniquePeople: 2, booked: 1, checkedIn: 1, cancelled: 1 });
    expect(rows.find((row) => row.code === data.cancelled.code)).toMatchObject({ status: "CANCELLED", session: { id: data.cancelled.session.id }, cancelledAt: expect.any(String) });
  });
  it("filter tanggal, sesi, status dan pencarian konsisten", async () => {
    const data = await fixtures();
    const filter = parseReportFilter(new URLSearchParams({ date: FRI, session: String(data.checked.session.order), status: "CHECKED_IN", q: "FIRST@EXAMPLE.TEST" }));
    expect((await getRegistrationReport(filter)).map((row) => row.code)).toEqual([data.checked.code]);
    expect(await getRegistrationReport({ status: "ACTIVE" })).toHaveLength(2);
    expect((await getRegistrationReport({ status: "CANCELLED", q: "BUDI" })).map((row) => row.code)).toEqual([data.cancelled.code]);
    expect(await getRegistrationReport({ q: "0812 3456 0001" })).toHaveLength(2);
    expect(await getRegistrationReport({ q: "Tidak ditemukan" })).toEqual([]);
  });
  it("filter tidak valid ditolak, bukan mengekspor seluruh data", async () => {
    for (const query of ["date=2026-12-25", "session=0", "session=7", "session=1.5", "status=UNKNOWN", `q=${"x".repeat(121)}`]) {
      const response = await request(`?${query}`);
      expect(response.status).toBe(400);
    }
  });
  it("endpoint Excel menolak akses tanpa sesi admin", async () => {
    expect((await request("", false)).status).toBe(401);
    expect((await exportExcel(new Request("http://localhost/api/admin/reports/export", { headers: { cookie: `${ADMIN_COOKIE}=invalid` } }))).status).toBe(401);
  });
});

describe("berkas Excel asli", () => {
  it("membuka XLSX dengan nol WhatsApp utuh, teks aman, waktu WIB dan ringkasan benar", async () => {
    const data = await fixtures();
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(response.headers.get("Content-Disposition")).toContain('.xlsx"');
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    const bytes = await response.arrayBuffer();
    expect(new Uint8Array(bytes).slice(0, 2)).toEqual(new Uint8Array([0x50, 0x4b]));
    const workbook = new Workbook();
    await workbook.xlsx.load(bytes);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Pendaftar", "Ringkasan"]);
    const sheet = workbook.getWorksheet("Pendaftar")!;
    expect(sheet.rowCount).toBe(4);
    const row = sheet.getRows(2, 3)!.find((item) => item.getCell(1).value === data.checked.code)!;
    expect(row.getCell(2).value).toBe("=2+3");
    expect(row.getCell(2).type).toBe(ValueType.String);
    expect(row.getCell(2).formula).toBeUndefined();
    expect(row.getCell(3).value).toBe("081234560001");
    expect(row.getCell(3).type).toBe(ValueType.String);
    expect(row.getCell(3).numFmt).toBe("@");
    expect(row.getCell(10).value).toBe("21/11/2026 17:00 WIB");
    expect(row.getCell(11).value).toBe("27/11/2026 14:05 WIB");
    const summary = workbook.getWorksheet("Ringkasan")!;
    const total = summary.getRows(1, summary.rowCount)!.find((item) => item.getCell(1).value === "TOTAL")!;
    expect([2, 3, 4, 5, 6].map((index) => total.getCell(index).value)).toEqual([3, 2, 1, 1, 1]);
  });
  it("ekspor memakai semua filter dan mengecualikan pendaftar lainnya", async () => {
    const data = await fixtures();
    const response = await request(`?date=${FRI}&session=${data.checked.session.order}&status=CHECKED_IN&q=first`);
    const workbook = new Workbook();
    await workbook.xlsx.load(await response.arrayBuffer());
    const sheet = workbook.getWorksheet("Pendaftar")!;
    expect(sheet.rowCount).toBe(2);
    expect(sheet.getCell("A2").value).toBe(data.checked.code);
  });
  it("hasil kosong tetap menjadi workbook valid dengan header", async () => {
    const response = await request("?q=kosong");
    const workbook = new Workbook();
    await workbook.xlsx.load(await response.arrayBuffer());
    expect(workbook.getWorksheet("Pendaftar")!.rowCount).toBe(1);
    expect(workbook.getWorksheet("Ringkasan")).toBeDefined();
  });
  it("ekspor tidak terpotong oleh batas 50 baris tampilan", async () => {
    const data = await fixtures();
    const sample = (await getRegistrationReport()).find((row) => row.code === data.booked.code)!;
    const rows = Array.from({ length: 55 }, (_, index) => ({ ...sample, id: String(index), code: `SB-${index}`, phone: `0812${String(index).padStart(8, "0")}` }));
    const workbook = new Workbook();
    await workbook.xlsx.load(await buildRegistrationWorkbook(rows, {}));
    expect(workbook.getWorksheet("Pendaftar")!.rowCount).toBe(56);
  });
});
