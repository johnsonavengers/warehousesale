import { NextResponse } from "next/server";
import { ADMIN_COOKIE, ADMIN_COOKIE_MAX_AGE, checkAdminPassword, expectedAdminToken } from "@/lib/auth";
import { AppError, api } from "@/lib/errors";
import { loginSchema } from "@/lib/validation";

export const POST = api(async (req: Request) => {
  const { password } = loginSchema.parse(await req.json());
  const token = await expectedAdminToken();
  if (!token) throw new AppError(401, "ADMIN_PASSWORD belum di-set di server");
  if (!(await checkAdminPassword(password))) throw new AppError(401, "Password salah");
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !process.env.INSECURE_COOKIES,
    path: "/",
    maxAge: ADMIN_COOKIE_MAX_AGE,
  });
  return res;
});

export const DELETE = api(async () => {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ADMIN_COOKIE);
  return res;
});
