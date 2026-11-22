import { defineConfig } from "@playwright/test";

const PORT = 3100;

/**
 * E2E berjalan pada database terpisah (e2e.db) dengan waktu dibekukan ke
 * Jumat 27 Nov 2026 13:40 WIB — sesi 1–2 sudah lewat, sesi 3 (14:00) masih bisa dipesan
 * dan sudah boleh check-in.
 */
const env = {
  DATABASE_URL: "file:./e2e.db",
  ADMIN_EMAIL: "admin@example.test",
  ADMIN_PASSWORD: "e2e-password",
  ADMIN_ACCOUNTS: JSON.stringify([{ email: "second-admin@example.test", password: "second-e2e-password" }]),
  NEXT_PUBLIC_BASE_URL: `http://localhost:${PORT}`,
  TEST_NOW: "2026-11-27T13:40:00+07:00",
  INSECURE_COOKIES: "1",
};

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {} },
  projects: [
    { name: "mobile-320", use: { viewport: { width: 320, height: 740 }, hasTouch: true, isMobile: true } },
    { name: "mobile-390", use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
    { name: "desktop-1280", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `prisma generate --schema prisma/schema.prisma && tsx scripts/db-init.ts --reset && tsx prisma/seed.ts && next build && next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 240_000,
    env,
  },
});
