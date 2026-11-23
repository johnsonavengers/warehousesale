import { NextResponse } from "next/server";
import { api, AppError } from "@/lib/errors";
import { requirePosAdmin } from "@/lib/pos-auth";
import { previewPosImport } from "@/lib/pos-import";
import { IMPORT_MAX_BYTES } from "@/lib/pos-import-types";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const POST = api(async (req: Request) => {
  const email = await requirePosAdmin(req);
  if (Number(req.headers.get("content-length")) > IMPORT_MAX_BYTES + 100_000) throw new AppError(400, "File maksimal 2 MB.");
  let form: FormData;
  try { form = await req.formData(); } catch { throw new AppError(400, "Unggah file Excel atau CSV yang valid."); }
  const file = form.get("file");
  if (!file || typeof file === "string" || file.size > IMPORT_MAX_BYTES) throw new AppError(400, "Pilih file Excel / CSV maksimal 2 MB.");
  return NextResponse.json(await previewPosImport(Buffer.from(await file.arrayBuffer()), file.name, String(form.get("mode")), email), { status: 201, headers: { "Cache-Control": "private, no-store" } });
});
