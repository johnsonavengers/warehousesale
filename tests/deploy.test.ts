import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const databaseUrl = "postgresql://tester:private-password@database.example/test";
const adminPassword = "private-admin-password";
const adminEmail = "admin@example.test";

function check(overrides: Record<string, string> = {}) {
  // Sengaja tidak mewarisi kredensial mesin atau env Vitest/SQLite.
  return spawnSync(process.execPath, ["scripts/predeploy-check.mjs"], {
    cwd: process.cwd(),
    env: { NODE_ENV: "test", ...overrides },
    encoding: "utf8",
  });
}

describe("pemeriksaan konfigurasi deployment", () => {
  it("menolak environment kosong dengan petunjuk database dan akun admin", () => {
    const result = check();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("DATABASE_URL belum tersedia");
    expect(result.stderr).toContain("ADMIN_PASSWORD belum di-set");
    expect(result.stderr).toContain("ADMIN_EMAIL belum di-set");
    expect(result.stderr).toContain("Production");
    expect(result.stderr).toContain("deployment baru");
  });

  it.each(["file:./dev.db", "postgresql://", "https://database.example/test", " postgresql://db/test"])(
    "menolak URL database yang tidak dapat dipakai untuk PostgreSQL: %s",
    (url) => {
      const result = check({ DATABASE_URL: url, ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: adminPassword });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("DATABASE_URL harus berupa URL koneksi PostgreSQL");
      expect(result.stderr).not.toContain(adminPassword);
    },
  );

  it.each(["   ", "ganti-password-ini"])("menolak password kosong/contoh: %s", (password) => {
    const result = check({ DATABASE_URL: databaseUrl, ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: password });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("ADMIN_PASSWORD belum di-set");
    expect(result.stderr).not.toContain(databaseUrl);
  });

  it.each(["postgresql", "postgres"])("menerima %s tanpa domain publik opsional", (protocol) => {
    const result = check({
      DATABASE_URL: databaseUrl.replace("postgresql:", `${protocol}:`),
      ADMIN_EMAIL: adminEmail,
      ADMIN_PASSWORD: adminPassword,
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("link WhatsApp memakai alamat website yang sedang dibuka");
    expect(result.stdout).toContain("Konfigurasi deploy OK");
    expect(result.stdout).not.toContain(databaseUrl);
    expect(result.stdout).not.toContain(adminPassword);
  });

  it("menunjukkan Preview dan commit yang sedang diperiksa", () => {
    const result = check({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_SHA: "10e9bc9abcdef" });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Preview, commit 10e9bc9");
    expect(result.stderr).toContain("Environment Variables (Preview)");
  });

  it.each(["DATABASE_URL_UNPOOLED", "DIRECT_URL"])(
    "menolak %s kosong karena akan menimpa koneksi migrasi yang valid",
    (key) => {
      const result = check({ DATABASE_URL: databaseUrl, ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: adminPassword, [key]: "" });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(`${key} harus berupa URL koneksi PostgreSQL`);
    },
  );

  it("mengikuti prioritas koneksi migrasi dan menerima domain publik yang diisi", () => {
    const result = check({
      DATABASE_URL: databaseUrl,
      DATABASE_URL_UNPOOLED: databaseUrl,
      DIRECT_URL: "",
      ADMIN_EMAIL: adminEmail,
      ADMIN_PASSWORD: adminPassword,
      NEXT_PUBLIC_BASE_URL: "https://tickets.example",
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).not.toContain("NEXT_PUBLIC_BASE_URL opsional");
  });

  it.each(["", "bukan-email"])("menolak email admin yang tidak valid: %s", (email) => {
    const result = check({ DATABASE_URL: databaseUrl, ADMIN_EMAIL: email, ADMIN_PASSWORD: adminPassword });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("ADMIN_EMAIL belum di-set atau format email tidak valid");
  });

  it("menerima akun admin tambahan tanpa menulis kredensial ke log", () => {
    const result = check({ DATABASE_URL: databaseUrl, ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: adminPassword,
      ADMIN_ACCOUNTS: JSON.stringify([{ email: "second@example.test", password: "extra-private-password" }]),
    });
    expect(result.status).toBe(0);
    expect(result.stdout + result.stderr).not.toContain("extra-private-password");
    expect(result.stdout + result.stderr).not.toContain("second@example.test");
  });

  it.each([
    "invalid-json",
    JSON.stringify({ email: "second@example.test", password: "extra-private-password" }),
    JSON.stringify([{ email: "not-an-email", password: "extra-private-password" }]),
    JSON.stringify([{ email: "second@example.test", password: " " }]),
    JSON.stringify([{ email: "second@example.test", password: "ganti-password-ini" }]),
    JSON.stringify([{ email: " ADMIN@example.test ", password: "extra-private-password" }]),
    JSON.stringify([{ email: "second@example.test", password: "extra-private-password" }, { email: " SECOND@example.test ", password: "different-password" }]),
    JSON.stringify(Array.from({ length: 21 }, (_, i) => ({ email: `admin${i}@example.test`, password: "extra-private-password" }))),
    JSON.stringify([{ email: "second@example.test", password: "x".repeat(4096) }]),
  ])("menolak konfigurasi akun tambahan rusak tanpa membocorkan password", (config) => {
    const result = check({ DATABASE_URL: databaseUrl, ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: adminPassword, ADMIN_ACCOUNTS: config });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("ADMIN_ACCOUNTS harus berupa array JSON");
    expect(result.stdout + result.stderr).not.toContain("extra-private-password");
    expect(result.stdout + result.stderr).not.toContain("second@example.test");
  });
});
