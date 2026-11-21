import { Workbook } from "exceljs";
import { expect, test, type Page } from "@playwright/test";

const ADMIN_PASSWORD = "e2e-password";
const ADMIN_EMAIL = "admin@example.test";
const dates = ["2026-11-27", "2026-11-28", "2026-11-29", "2026-12-04", "2026-12-05", "2026-12-06", "2026-12-11", "2026-12-12", "2026-12-13"];
function fixtureFor(project: string) {
  const i = project === "mobile-320" ? 1 : project === "mobile-390" ? 2 : 3;
  return { name: `Pengunjung ${project}`, phone: `08131111000${i}`, secondPhone: `08135555000${i}` };
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
  await expect(page.getByLabel("Nama lengkap")).toBeInViewport();
  const formBox = await page.getByRole("form", { name: "Form pendaftaran" }).boundingBox();
  const summaryBox = await page.getByRole("region", { name: "Ringkasan pesanan" }).boundingBox();
  if (testInfo.project.name.startsWith("mobile")) expect(formBox!.y + formBox!.height).toBeLessThan(summaryBox!.y);
  else expect(formBox!.x).toBeLessThan(summaryBox!.x);
  await expect(page.getByText("Diacak otomatis", { exact: true })).toBeVisible();
  await expect(page.getByTestId("seat-grid")).toHaveCount(0);
  await expect(page.getByTestId("countdown")).toHaveCount(0);
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("checkout.png"), fullPage: true });
  await page.getByLabel("Nama lengkap").fill(fx.name);
  await page.getByLabel("No. WhatsApp").fill("12345");
  await page.getByRole("button", { name: "Pesan tiket" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "WhatsApp tidak valid" })).toBeVisible();
  await page.getByLabel("No. WhatsApp").fill(fx.phone);
  const bookingResponse = page.waitForResponse((r) => r.url().endsWith("/api/tickets") && r.request().method() === "POST" && r.status() === 201);
  await page.getByRole("button", { name: "Pesan tiket" }).click();
  const assigned = await (await bookingResponse).json();
  await expect(page).toHaveURL(/\/ticket\/JM-\d{3}-[A-Z2-9]{4}/);
  await expect(page.getByTestId("ticket-number")).toHaveText(String(assigned.queueNumber));
  await expect(page.getByText(`Jam kunjungan · Sesi ${assigned.session.order}`)).toBeVisible();
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
  if (assigned.session.order > 3) {
    await expect(result).toHaveAttribute("data-result", "wrong_session");
    await page.getByRole("button", { name: "Tetap check-in", exact: true }).click();
  }
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
  for (const path of ["/admin", "/admin/tickets", "/admin/checkin", "/admin/laporan"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/login/);
  }
  expect((await request.post("/api/admin/checkin", { data: { code: "JM-001-AAAA" } })).status()).toBe(401);
  expect((await request.get("/api/admin/export?date=2026-11-27")).status()).toBe(401);
  expect((await request.get("/api/admin/reports/export")).status()).toBe(401);
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
  const seats = await (await request.get(`/api/sessions/${ticket.session.id}/seats`)).json();
  expect(seats.seats.find((s: { number: number }) => s.number === ticket.queueNumber).status).toBe("available");
  const again = await request.post("/api/tickets", { data: { date: "2026-11-27", name: "Pesan kembali", phone: fx.secondPhone } });
  expect(again.status()).toBe(201);
  const replacement = await again.json();
  expect(replacement.queueNumber).toBeGreaterThanOrEqual(101);
  expect(replacement.queueNumber).toBeLessThanOrEqual(300);
  expect(replacement.session.order).toBe(Math.floor((replacement.queueNumber - 1) / 50) + 1);
  await page.goto(`/admin/tickets?q=${replacement.code}`);
  await page.getByRole("button", { name: /Batalkan tiket/ }).click();
  await page.getByRole("button", { name: "Ya, batalkan" }).click();
  await expect(page.getByTestId(`row-${replacement.code}`)).toHaveCount(0);
});


test("klik tanggal langsung memberi respons meskipun jaringan lambat", async ({ page }, testInfo) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/checkout**", async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page.goto("/");
    const started = Date.now();
    await page.getByTestId("day-2026-12-13").click();
    await expect(page.getByRole("status").filter({ hasText: /halaman/ }).first()).toBeVisible({ timeout: 700 });
    await expect(page.getByRole("status").filter({ hasText: /halaman/ }).first()).toBeInViewport();
    const elapsed = Date.now() - started;
    await testInfo.attach("navigation-feedback-ms", { body: String(elapsed), contentType: "text/plain" });
    release();
    await expect(page.getByLabel("Nama lengkap")).toBeVisible();
    await expect(page.getByRole("link", { name: /Pilih sesi|Pilih nomor/ })).toHaveCount(0);
  } finally {
    release();
  }
});


test("laporan admin: filter pendaftar, riwayat batal, ekspor Excel asli", async ({ page, request }, testInfo) => {
  const suffix = testInfo.project.name === "mobile-320" ? "1" : testInfo.project.name === "mobile-390" ? "2" : "3";
  const name = `Peserta Laporan ${testInfo.project.name}`;
  const phone = `08128888000${suffix}`;
  const registered = await (await request.post("/api/tickets", { data: { date: "2026-12-13", name, phone, email: "laporan@example.test" } })).json();
  const cancelled = await (await request.post("/api/tickets", { data: { date: "2026-12-12", name: `Batal ${testInfo.project.name}`, phone: `08129999000${suffix}` } })).json();
  await login(page);
  expect((await page.request.patch(`/api/admin/tickets/${registered.id}`, { data: { status: "CHECKED_IN" } })).status()).toBe(200);
  expect((await page.request.patch(`/api/admin/tickets/${cancelled.id}`, { data: { status: "CANCELLED" } })).status()).toBe(200);
  await page.getByRole("link", { name: "Lihat laporan pendaftar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Laporan pendaftar" })).toBeVisible();
  await page.getByLabel("Tanggal kunjungan", { exact: true }).selectOption("2026-12-13");
  await page.getByLabel("Sesi", { exact: true }).selectOption(String(registered.session.order));
  await page.getByLabel("Status pendaftaran").selectOption("CHECKED_IN");
  await page.getByLabel("Cari pendaftar").fill(name);
  await page.getByRole("button", { name: "Terapkan filter" }).click();
  await expect(page).toHaveURL(/status=CHECKED_IN/);
  await expect(page.getByText("Menampilkan 1–1 dari 1 pendaftaran", { exact: true })).toBeVisible();
  const row = page.getByTestId(`${testInfo.project.name.startsWith("mobile") ? "report-card" : "report-row"}-${registered.code}`);
  await expect(row).toContainText(name);
  await expect(row).toContainText(phone);
  await expect(row).toContainText("laporan@example.test");
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("admin-report.png"), fullPage: true });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Ekspor Excel", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("laporan-pendaftar-2026-12-13.xlsx");
  const path = testInfo.outputPath("laporan.xlsx");
  await download.saveAs(path);
  const workbook = new Workbook();
  await workbook.xlsx.readFile(path);
  const sheet = workbook.getWorksheet("Pendaftar")!;
  expect(sheet.rowCount).toBe(2);
  expect(sheet.getCell("A2").value).toBe(registered.code);
  expect(sheet.getCell("B2").value).toBe(name);
  expect(sheet.getCell("C2").value).toBe(phone);
  await page.getByRole("link", { name: "Reset filter", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/laporan$/);
  await page.getByLabel("Status pendaftaran").selectOption("CANCELLED");
  await page.getByLabel("Cari pendaftar").fill(`Batal ${testInfo.project.name}`);
  await page.getByRole("button", { name: "Terapkan filter" }).click();
  await expect(page.getByText("Menampilkan 1–1 dari 1 pendaftaran", { exact: true })).toBeVisible();
  await expect(page.getByTestId(`${testInfo.project.name.startsWith("mobile") ? "report-card" : "report-row"}-${cancelled.code}`)).toContainText("Dibatalkan");
});
