import { NextRequest } from "next/server";
import { ADMIN_COOKIE, adminEmailForToken } from "./auth";
import { AppError } from "./errors";

export async function requirePosAdmin(req: Request): Promise<string> {
  const email = await adminEmailForToken(new NextRequest(req.url, { headers: req.headers }).cookies.get(ADMIN_COOKIE)?.value);
  if (!email) throw new AppError(401, "Silakan login sebagai admin.");
  return email;
}
