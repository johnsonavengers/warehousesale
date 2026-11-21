import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/auth";
import { api } from "@/lib/errors";
import { getRegistrationReport, parseReportFilter } from "@/lib/registration-report";
import { buildRegistrationWorkbook } from "@/lib/report-excel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api(async (req: Request) => {
  // Tetap lindungi berkas data pribadi meskipun handler dipanggil tanpa middleware.
  const token = new NextRequest(req).cookies.get(ADMIN_COOKIE)?.value;
  if (!(await isValidAdminToken(token))) return NextResponse.json({ error: "Silakan login sebagai admin untuk mengekspor laporan." }, { status: 401 });
  const filter = parseReportFilter(new URL(req.url).searchParams);
  const rows = await getRegistrationReport(filter);
  const buffer = await buildRegistrationWorkbook(rows, filter);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="laporan-pendaftar-${filter.date ?? "semua-tanggal"}.xlsx"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
