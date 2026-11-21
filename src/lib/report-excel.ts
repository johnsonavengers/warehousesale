import { Workbook, type Worksheet } from "exceljs";
import { EVENT } from "@/config/event";
import { SCHEDULE } from "@/config/schedule";
import { formatEventDateTime } from "./time";
import { REPORT_STATUS_LABEL, summarizeRegistrations, type RegistrationRow, type ReportFilter } from "./registration-report";

function styleHeader(sheet: Worksheet, rowNumber: number) {
  const row = sheet.getRow(rowNumber);
  row.height = 28;
  row.eachCell((cell) => {
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFDA45" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF171917" } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
}

export async function buildRegistrationWorkbook(rows: RegistrationRow[], filter: ReportFilter, now = new Date()) {
  const workbook = new Workbook();
  workbook.creator = EVENT.name;
  workbook.created = now;
  workbook.modified = now;
  workbook.subject = "Laporan pendaftaran";
  const sheet = workbook.addWorksheet("Pendaftar", {
    views: [{ state: "frozen", ySplit: 1 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  sheet.columns = [
    { header: "Kode tiket", key: "code", width: 20 },
    { header: "Nama lengkap", key: "name", width: 30 },
    { header: "WhatsApp", key: "phone", width: 20, style: { numFmt: "@" } },
    { header: "Email", key: "email", width: 32 },
    { header: "Tanggal kunjungan", key: "date", width: 22 },
    { header: "Sesi", key: "session", width: 10 },
    { header: "Jam sesi (WIB)", key: "time", width: 20 },
    { header: "No. antrian", key: "number", width: 15 },
    { header: "Status", key: "status", width: 22 },
    { header: "Waktu daftar (WIB)", key: "created", width: 27 },
    { header: "Waktu check-in (WIB)", key: "checkin", width: 27 },
    { header: "Waktu pembatalan (WIB)", key: "cancelled", width: 29 },
  ];
  for (const entry of rows) {
    // Input pengguna selalu nilai string, bukan objek formula/hyperlink Excel.
    const row = sheet.addRow({
      code: entry.code, name: entry.name, phone: entry.phone, email: entry.email ?? "",
      date: entry.date, session: entry.session?.order ?? "",
      time: entry.session ? `${entry.session.startTime}–${entry.session.endTime}` : "",
      number: entry.queueNumber, status: REPORT_STATUS_LABEL[entry.status],
      created: formatEventDateTime(new Date(entry.createdAt)),
      checkin: entry.checkedInAt ? formatEventDateTime(new Date(entry.checkedInAt)) : "",
      cancelled: entry.cancelledAt ? formatEventDateTime(new Date(entry.cancelledAt)) : "",
    });
    row.height = 32;
    row.eachCell((cell) => {
      cell.font = { name: "Calibri", size: 11, color: { argb: "FF17202A" } };
      cell.alignment = { vertical: "middle", wrapText: true };
      if (row.number % 2 === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F5F2" } };
    });
  }
  styleHeader(sheet, 1);
  sheet.autoFilter = { from: "A1", to: `L${Math.max(1, sheet.rowCount)}` };

  const summary = workbook.addWorksheet("Ringkasan", { views: [{ state: "frozen", ySplit: 5 }] });
  summary.columns = [{ width: 28 }, { width: 18 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 18 }];
  summary.mergeCells("A1:F1");
  summary.getCell("A1").value = `${EVENT.name} · Laporan pendaftar`;
  summary.getCell("A1").font = { bold: true, size: 16, color: { argb: "FF171917" } };
  summary.getRow(1).height = 32;
  summary.mergeCells("A2:F2");
  summary.getCell("A2").value = `Diekspor: ${formatEventDateTime(now)}`;
  summary.mergeCells("A3:F3");
  const status = filter.status === "ACTIVE" ? "Tiket aktif" : filter.status ? REPORT_STATUS_LABEL[filter.status] : "Semua status";
  summary.getCell("A3").value = `${filter.date ?? "Semua tanggal"} · ${filter.sessionOrder ? `Sesi ${filter.sessionOrder}` : "Semua sesi"} · ${status}${filter.q ? ` · Pencarian: ${filter.q}` : ""}`;
  summary.getCell("A3").alignment = { wrapText: true, vertical: "middle" };
  summary.getRow(3).height = 40;
  summary.getRow(5).values = ["Tanggal kunjungan", "Pendaftaran", "Pengunjung unik", "Belum check-in", "Sudah check-in", "Dibatalkan"];
  styleHeader(summary, 5);
  const dates = filter.date ? [filter.date] : Array.from(new Set([...SCHEDULE.map((day) => day.date), ...rows.map((row) => row.date)])).sort();
  for (const date of dates) {
    const totals = summarizeRegistrations(rows.filter((row) => row.date === date));
    summary.addRow([date, totals.total, totals.uniquePeople, totals.booked, totals.checkedIn, totals.cancelled]);
  }
  const totals = summarizeRegistrations(rows);
  const totalRow = summary.addRow(["TOTAL", totals.total, totals.uniquePeople, totals.booked, totals.checkedIn, totals.cancelled]);
  totalRow.font = { bold: true, color: { argb: "FF171917" } };
  totalRow.eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFDA45" } }; });
  summary.addRow(["Pengunjung unik dihitung dari nomor WhatsApp; satu orang dapat mendaftar pada beberapa tanggal."]);
  summary.mergeCells(`A${summary.rowCount}:F${summary.rowCount}`);
  summary.getRow(summary.rowCount).height = 32;
  summary.getCell(`A${summary.rowCount}`).alignment = { wrapText: true };
  return workbook.xlsx.writeBuffer();
}
