import { expect, test, type Page } from "@playwright/test";

const ADMIN_PASSWORD = "e2e-password";
const ADMIN_EMAIL = "admin@example.test";
const dates = ["2026-11-27", "2026-11-28", "2026-11-29", "2026-12-04", "2026-12-05", "2026-12-06", "2026-12-11", "2026-12-12", "2026-12-13"];
function fixtureFor(project: string) {
  const i = project === "mobile-320" ? 1 : project === "mobile-390" ? 2 : 3;
  return { seat: 60 + i, name: `Pengunjung ${project}`, phone: `08131111000${i}`, secondPhone: `08135555000${i}` };
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}
async function login(page: Page) {
  await page.goto("/admin");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

test("tanggal → data → sesi & nomor otomatis → tiket → check-in admin", async ({ page }, testInfo) => {
  const fx = fixtureFor(testInfo.project.name);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Pilih tanggal", exact: true })).toBeVisible();
  for (const date of dates) await expect(page.getByTestId(`day-${date}`)).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("home.png"), fullPage: true });
  const day = page.getByTestId("day-2026-11-27");
  const bounds = await day.boundingBox();
  expect(bounds!.width).toBeGreaterThanOrEqual(44);
  expect(bounds!.height).toBeGreaterThanOrEqual(44);
  await day.click();
  await expect(page).toHaveURL(/\/checkout\?date=2026-11-27/);
  await expect(page.getByText("Diatur otomatis", { exact: true })).toBeVisible();
  await expect(page.getByTestId("seat-grid")).toHaveCount(0);
  await expect(page.getByTestId("countdown")).toHaveCount(0);
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("checkout.png"), fullPage: true });
  await page.getByLabel("Nama lengkap").fill(fx.name);
  await page.getByLabel("No. WhatsApp").fill("12345");
  await page.getByRole("button", { name: "Pesan tiket" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "WhatsApp tidak valid" })).toBeVisible();
  await page.getByLabel("No. WhatsApp").fill(fx.phone);
  await page.getByRole("button", { name: "Pesan tiket" }).click();
  await expect(page).toHaveURL(/\/ticket\/JM-0\d\d-[A-Z2-9]{4}/);
  await expect(page.getByTestId("ticket-number")).toHaveText(String(fx.seat));
  await expect(page.getByText("Jam kunjungan · Sesi 3")).toBeVisible();
  await expect(page.getByTestId("ticket-name")).toHaveText(fx.name);
  await expect(page.getByTestId("ticket-status")).toHaveText("Terpesan");
  const qr = page.getByTestId("ticket-qr");
  await expect(qr).toBeVisible();
  expect(await qr.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(100);
  const code = (await page.getByTestId("ticket-code").textContent())!.trim();
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("ticket.png"), fullPage: true });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Simpan sebagai gambar" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(`tiket-${code}.png`);
  await file.saveAs(testInfo.outputPath("downloaded-ticket.png"));
  await expect(page.getByRole("button", { name: "Bagikan ke WhatsApp" })).toBeVisible();
  await page.goto("/cari");
  await page.getByLabel("No. WhatsApp").fill(fx.phone);
  await page.getByRole("button", { name: "Cari", exact: true }).click();
  await expect(page.getByText(code)).toBeVisible();
  await expect(page.getByText(fx.phone, { exact: true })).toHaveCount(0);
  await noOverflow(page);
  await page.goto("/admin/checkin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.getByLabel("Email", { exact: true }).fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill("password-salah");
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Email atau password salah" })).toBeVisible();
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/admin\/checkin$/);
  await page.getByLabel("Kode tiket").fill(code);
  await page.getByRole("button", { name: "Check-in", exact: true }).click();
  const result = page.getByTestId("checkin-result");
  await expect(result).toHaveAttribute("data-result", "ok");
  await expect(result).toContainText(fx.name);
  await page.getByLabel("Kode tiket").fill(code);
  await page.getByRole("button", { name: "Check-in", exact: true }).click();
  await expect(result).toHaveAttribute("data-result", "already");
  await page.goto(`/admin/tickets?q=${code}`);
  await expect(page.getByTestId(`row-${code}`).getByTestId("row-status")).toContainText("CHECKED_IN");
  await page.goto(`/ticket/${code}`);
  await expect(page.getByTestId("ticket-status")).toHaveText("Sudah check-in");
});

test("link lama langsung ke data; tanggal tidak tersedia aman", async ({ page }) => {
  for (const path of ["/2026-11-28", "/2026-12-13/old-session"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/checkout\?date=/);
    await expect(page.getByLabel("Nama lengkap")).toBeVisible();
  }
  await page.goto("/checkout?date=2026-12-25");
  await expect(page.getByText(/Tanggal belum dipilih/)).toBeVisible();
  await expect(page.getByLabel("Nama lengkap")).toHaveCount(0);
});

test("admin tetap dilindungi login", async ({ page, request }) => {
  for (const path of ["/admin", "/admin/tickets", "/admin/checkin"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/login/);
  }
  expect((await request.post("/api/admin/checkin", { data: { code: "JM-001-AAAA" } })).status()).toBe(401);
  expect((await request.get("/api/admin/export?date=2026-11-27")).status()).toBe(401);
});

test("admin memanggil antrian dan pembatalan membebaskan nomor otomatis", async ({ page, request }, testInfo) => {
  const fx = fixtureFor(testInfo.project.name);
  const response = await request.post("/api/tickets", { data: { date: "2026-11-27", name: "Akan Dibatalkan", phone: fx.secondPhone } });
  expect(response.status()).toBe(201);
  const ticket = await response.json();
  await login(page);
  await page.getByLabel("Set nomor yang dipanggil untuk Jumat, 27 Nov").fill(String(ticket.queueNumber));
  await page.getByLabel("Set nomor yang dipanggil untuk Jumat, 27 Nov").press("Enter");
  await page.goto("/display/2026-11-27");
  await expect(page.getByTestId("now-serving-number")).toHaveText(String(ticket.queueNumber));
  await page.goto(`/admin/tickets?q=${ticket.code}`);
  await page.getByRole("button", { name: /Batalkan tiket/ }).click();
  await page.getByRole("button", { name: "Ya, batalkan" }).click();
  await expect(page.getByTestId(`row-${ticket.code}`)).toHaveCount(0);
  const again = await request.post("/api/tickets", { data: { date: "2026-11-27", name: "Pesan kembali", phone: fx.secondPhone } });
  expect(again.status()).toBe(201);
  const replacement = await again.json();
  expect(replacement.queueNumber).toBe(ticket.queueNumber);
  await page.goto(`/admin/tickets?q=${replacement.code}`);
  await page.getByRole("button", { name: /Batalkan tiket/ }).click();
  await page.getByRole("button", { name: "Ya, batalkan" }).click();
  await expect(page.getByTestId(`row-${replacement.code}`)).toHaveCount(0);
});
