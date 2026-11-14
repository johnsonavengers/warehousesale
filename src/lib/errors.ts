import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** Error bisnis dengan status HTTP. `extra` ikut dikirim di body response. */
export class AppError extends Error {
  constructor(
    public status: 400 | 401 | 404 | 409,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const SEAT_TAKEN_MESSAGE =
  "Nomor ini baru saja diambil orang lain, silakan pilih nomor lain.";

/** Unique constraint violation (Prisma P2002). */
export function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

export function errorResponse(e: unknown): NextResponse {
  if (e instanceof AppError) {
    return NextResponse.json({ error: e.message, ...e.extra }, { status: e.status });
  }
  if (e instanceof ZodError) {
    const msg = e.issues[0]?.message ?? "Input tidak valid";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  if (e instanceof SyntaxError) {
    return NextResponse.json({ error: "Body request bukan JSON yang valid" }, { status: 400 });
  }
  console.error(e);
  return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
}

/** Bungkus handler API agar semua error keluar dalam format { error: string }. */
export function api<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse | Response>,
) {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (e) {
      return errorResponse(e);
    }
  };
}
