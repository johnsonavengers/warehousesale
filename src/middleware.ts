import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/auth";

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Pengecualian: halaman & API login, dan GET "sekarang dipanggil" (untuk layar publik).
  if (pathname === "/admin/login" || pathname === "/api/admin/login") return NextResponse.next();
  if (pathname === "/api/admin/now-serving" && req.method === "GET") return NextResponse.next();

  if (await isValidAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Tidak diizinkan. Silakan login sebagai admin." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}
