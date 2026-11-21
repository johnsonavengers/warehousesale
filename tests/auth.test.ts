import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as login } from "@/app/api/admin/login/route";
import { ADMIN_COOKIE, expectedAdminToken, isValidAdminToken } from "@/lib/auth";

afterEach(() => vi.unstubAllEnvs());

function request(body: unknown) {
  return new Request("http://localhost/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("login admin dengan email dan password", () => {
  it("menerima email dengan kapital/spasi, lalu menerbitkan cookie httpOnly", async () => {
    vi.stubEnv("ADMIN_EMAIL", " Admin@Example.Test ");
    const result = await login(request({ email: " ADMIN@example.test ", password: "test-password" }));
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ ok: true });
    const cookie = result.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${ADMIN_COOKIE}=`);
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
    expect(cookie).not.toContain("test-password");
  });

  it.each([
    { email: "other@example.test", password: "test-password" },
    { email: "admin@example.test", password: "wrong-password" },
    { email: "admin@example.test", password: " test-password " },
  ])("menolak kredensial yang tidak cocok tanpa cookie: $email", async (credentials) => {
    const result = await login(request(credentials));
    expect(result.status).toBe(401);
    expect(await result.json()).toEqual({ error: "Email atau password salah" });
    expect(result.headers.get("set-cookie")).toBeNull();
  });

  it.each([
    { password: "test-password" },
    { email: "invalid", password: "test-password" },
    { email: "admin@example.test", password: "" },
  ])("menolak input yang tidak lengkap atau tidak valid", async (credentials) => {
    const result = await login(request(credentials));
    expect(result.status).toBe(400);
    expect(result.headers.get("set-cookie")).toBeNull();
  });

  it.each(["ADMIN_EMAIL", "ADMIN_PASSWORD"])("menolak login jika %s belum diatur", async (key) => {
    vi.stubEnv(key, "");
    const result = await login(request({ email: "admin@example.test", password: "test-password" }));
    expect(result.status).toBe(401);
    expect(await expectedAdminToken()).toBeNull();
    expect(result.headers.get("set-cookie")).toBeNull();
  });

  it.each([
    ["ADMIN_EMAIL", "new-admin@example.test"],
    ["ADMIN_PASSWORD", "new-password"],
  ])("membatalkan cookie lama setelah %s berubah", async (key, value) => {
    const previous = await expectedAdminToken();
    expect(await isValidAdminToken(previous!)).toBe(true);
    vi.stubEnv(key, value);
    expect(await isValidAdminToken(previous!)).toBe(false);
  });
});
