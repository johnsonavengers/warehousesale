import { api } from "@/lib/errors";
import { requirePosAdmin } from "@/lib/pos-auth";
import { posImportTemplate } from "@/lib/pos-import-file";
export const dynamic = "force-dynamic";
export const GET = api(async (req: Request) => {
  await requirePosAdmin(req);
  const csv = new URL(req.url).searchParams.get("format") === "csv";
  const data = csv ? "\uFEFFSKU,Nama,Harga,Stok\r\n" : new Uint8Array(await posImportTemplate());
  return new Response(data, { headers: { "Content-Type": csv ? "text/csv; charset=utf-8" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="template-produk.${csv ? "csv" : "xlsx"}"`, "Cache-Control": "private, no-store" } });
});
