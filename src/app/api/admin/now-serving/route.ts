import { NextResponse } from "next/server";
import { getNowServing, setNowServing } from "@/lib/booking";
import { AppError, api } from "@/lib/errors";
import { dateSchema, nowServingSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** GET bersifat publik (dipakai layar /display/[date]); POST khusus admin (lihat middleware). */
export const GET = api(async (req: Request) => {
  const date = dateSchema.parse(new URL(req.url).searchParams.get("date") ?? "");
  const data = await getNowServing(date);
  if (!data) throw new AppError(404, "Tanggal tidak ditemukan");
  return NextResponse.json(data);
});

export const POST = api(async (req: Request) => {
  const { date, number } = nowServingSchema.parse(await req.json());
  return NextResponse.json(await setNowServing(date, number));
});
