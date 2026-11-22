import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as login } from "@/app/api/admin/login/route";
import { ADMIN_COOKIE, checkAdminCredentials, expectedAdminToken, isValidAdminToken } from "@/lib/auth";

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

describe("akun admin tambahan", () => {
  const secondary = { email: "second@example.test", password: "second-password" };

  it("kedua akun bisa login dan mendapat sesi masing-masing", async () => {
    const primaryToken = await expectedAdminToken();
    vi.stubEnv("ADMIN_ACCOUNTS", JSON.stringify([secondary]));
    const primary = await login(request({ email: "admin@example.test", password: "test-password" }));
    const second = await login(request({ email: " SECOND@example.test ", password: secondary.password }));
    expect(primary.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await expectedAdminToken()).toBe(primaryToken);
    const secondToken = await expectedAdminToken(secondary.email);
    expect(secondToken).not.toBe(primaryToken);
    expect(second.headers.get("set-cookie")).toContain(`${ADMIN_COOKIE}=${secondToken}`);
    expect(await isValidAdminToken(primaryToken!)).toBe(true);
    expect(await isValidAdminToken(secondToken!)).toBe(true);
  });

  it("password satu akun tidak dapat dipakai untuk akun lain", async () => {
    vi.stubEnv("ADMIN_ACCOUNTS", JSON.stringify([secondary]));
    for (const credentials of [
      { email: secondary.email, password: "test-password" },
      { email: "admin@example.test", password: secondary.password },
      { email: "unknown@example.test", password: secondary.password },
    ]) {
      const result = await login(request(credentials));
      expect(result.status).toBe(401);
      expect(result.headers.get("set-cookie")).toBeNull();
    }
  });

  it("menghapus atau mengganti password akun tambahan membatalkan hanya sesinya", async () => {
    vi.stubEnv("ADMIN_ACCOUNTS", JSON.stringify([secondary]));
    const primary = await expectedAdminToken();
    const old = await expectedAdminToken(secondary.email);
    vi.stubEnv("ADMIN_ACCOUNTS", JSON.stringify([{ ...secondary, password: "changed-password" }]));
    expect(await isValidAdminToken(old!)).toBe(false);
    const changed = await expectedAdminToken(secondary.email);
    expect(await isValidAdminToken(changed!)).toBe(true);
    expect(await isValidAdminToken(primary!)).toBe(true);
    vi.stubEnv("ADMIN_ACCOUNTS", "[]");
    expect(await isValidAdminToken(changed!)).toBe(false);
    expect(await isValidAdminToken(primary!)).toBe(true);
    expect(await checkAdminCredentials(secondary.email, "changed-password")).toBe(false);
  });

  it.each(["broken-json", '{"email":"second@example.test","password":"second-password"}', JSON.stringify([
    { email: "admin@example.test", password: "replacement-password" },
  ])])("konfigurasi tambahan tidak valid tidak mengubah akun utama", async (config) => {
    const primary = await expectedAdminToken();
    vi.stubEnv("ADMIN_ACCOUNTS", config);
    expect(await expectedAdminToken()).toBe(primary);
    expect(await expectedAdminToken(secondary.email)).toBeNull();
    expect(await checkAdminCredentials("admin@example.test", "test-password")).toBe(true);
    expect(await checkAdminCredentials("admin@example.test", "replacement-password")).toBe(false);
  });

  it("akun berbeda dengan password sama tetap memiliki sesi terpisah", async () => {
    vi.stubEnv("ADMIN_ACCOUNTS", JSON.stringify([{ ...secondary, password: "test-password" }]));
    expect(await checkAdminCredentials(secondary.email, "test-password")).toBe(true);
    expect(await expectedAdminToken(secondary.email)).not.toBe(await expectedAdminToken());
  });
});
