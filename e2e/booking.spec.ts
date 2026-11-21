import { expect, test } from "@playwright/test";

const ADMIN_PASSWORD = "e2e-password";
const ADMIN_EMAIL = "admin@example.test";

// Tiap project (mobile/desktop) memakai nomor & HP berbeda karena berbagi satu database.
function fixtureFor(project: string) {
  return project.startsWith("mobile")
    ? { seat: 65, name: "Rina Mobile", phone: "081311112222" }
    : { seat: 72, name: "Dodi Desktop", phone: "081333334444" };
}

test("alur utama: tanggal → sesi → nomor → data → e-tiket → check-in admin", async ({ page }, testInfo) => {
  const fx = fixtureFor(testInfo.project.name);

  // 1. Pilih tanggal
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Pilih tanggal" })).toBeVisible();
  await expect(page.getByTestId("day-2026-11-27")).toContainText("Jumat");
  await page.getByTestId("day-2026-11-27").click();

  // 2. Pilih sesi — istirahat Jumat 11:30–14:00 tampil, sesi yang sudah mulai nonaktif
  await expect(page.getByRole("heading", { name: "Pilih sesi" })).toBeVisible();
  await expect(page.getByTestId("break")).toHaveCount(1);
  await expect(page.getByTestId("break")).toContainText("11:30 – 14:00");
  await expect(page.getByTestId("break")).toContainText("Istirahat");
  await expect(page.getByTestId("session-1").getByRole("link")).toHaveCount(0);
  await expect(page.getByTestId("session-1")).toContainText("Sudah dimulai");
  await expect(page.getByTestId("session-3")).toContainText("61–90");
  await page.getByTestId("session-3").getByRole("link").click();

  // 3. Pilih nomor
  await expect(page.getByRole("heading", { name: "Pilih nomor antrian" })).toBeVisible();
  await expect(page.getByTestId("seat-grid").getByRole("button")).toHaveCount(30);
  await expect(page.getByText("Tersedia", { exact: true })).toBeVisible(); // legenda
  const seat = page.getByTestId(`seat-${fx.seat}`);
  const box = await seat.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await seat.click();
  await expect(seat).toHaveAttribute("data-status", "selected");
  await expect(page.getByTestId("selected-number")).toHaveText(String(fx.seat));
  await page.getByRole("button", { name: "Lanjut" }).click();

  // 4. Isi data (nomor dikunci, countdown tampil)
  await expect(page).toHaveURL(/\/checkout\?hold=/);
  await expect(page.getByTestId("checkout-number")).toHaveText(String(fx.seat));
  await expect(page.getByTestId("countdown")).toHaveText(/^0[45]:\d\d$/);
  // Validasi server: nomor HP salah ditolak
  await page.getByLabel("Nama lengkap").fill(fx.name);
  await page.getByLabel("No. WhatsApp").fill("12345");
  await page.getByRole("button", { name: "Pesan tiket" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "WhatsApp tidak valid" })).toBeVisible();
  await page.getByLabel("No. WhatsApp").fill(fx.phone);
  await page.getByRole("button", { name: "Pesan tiket" }).click();

  // 5. E-tiket dengan QR
  await expect(page).toHaveURL(/\/ticket\/JM-0\d\d-[A-Z2-9]{4}/);
  await expect(page.getByTestId("ticket-number")).toHaveText(String(fx.seat));
  await expect(page.getByTestId("ticket-name")).toHaveText(fx.name);
  await expect(page.getByTestId("ticket-status")).toHaveText("Terpesan");
  const qr = page.getByTestId("ticket-qr");
  await expect(qr).toBeVisible();
  expect(await qr.getAttribute("src")).toMatch(/^data:image\/png;base64,/);
  expect(await qr.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(100);
  const code = (await page.getByTestId("ticket-code").textContent())!.trim();
  expect(code).toMatch(new RegExp(`^JM-0${fx.seat}-[A-Z2-9]{4}$`));
  await expect(page.getByRole("button", { name: "Simpan sebagai gambar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bagikan ke WhatsApp" })).toBeVisible();

  // 6. Nomor yang sudah dipesan tampil abu-abu & tidak bisa diklik
  await page.goto("/2026-11-27");
  await page.getByTestId("session-3").getByRole("link").click();
  const taken = page.getByTestId(`seat-${fx.seat}`);
  await expect(taken).toBeDisabled();
  await expect(taken).toHaveAttribute("data-status", "booked");
  await expect(taken).toHaveClass(/bg-stone-700/);

  // 7. Cari tiket via nomor WhatsApp (nomor tersamarkan)
  await page.goto("/cari");
  await page.getByLabel("No. WhatsApp").fill(fx.phone);
  await page.getByRole("button", { name: "Cari" }).click();
  await expect(page.getByText(code)).toBeVisible();
  await expect(page.getByText(fx.phone)).toHaveCount(0);

  // 8. Admin: wajib login
  await page.goto("/admin/checkin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.getByLabel("Email", { exact: true }).fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill("password-salah");
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Email atau password salah" })).toBeVisible();
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/admin\/checkin$/);

  // 9. Check-in dengan kode tiket
  await page.getByLabel("Kode tiket").fill(code);
  await page.getByRole("button", { name: "Check-in", exact: true }).click();
  const result = page.getByTestId("checkin-result");
  await expect(result).toHaveAttribute("data-result", "ok");
  await expect(result).toContainText(fx.name);
  await expect(result).toContainText(String(fx.seat));

  // Scan ulang → peringatan sudah check-in
  await page.getByLabel("Kode tiket").fill(code);
  await page.getByRole("button", { name: "Check-in", exact: true }).click();
  await expect(result).toHaveAttribute("data-result", "already");
  // Kode ngawur → tidak ditemukan
  await page.getByLabel("Kode tiket").fill("JM-999-ZZZZ");
  await page.getByRole("button", { name: "Check-in", exact: true }).click();
  await expect(result).toHaveAttribute("data-result", "not_found");

  // 10. Status berubah CHECKED_IN di daftar tiket & di e-tiket
  await page.goto(`/admin/tickets?q=${code}`);
  await expect(page.getByTestId(`row-${code}`).getByTestId("row-status")).toContainText("CHECKED_IN");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.goto(`/ticket/${code}`);
  await expect(page.getByTestId("ticket-status")).toHaveText("Sudah check-in");
});

test("istirahat Sabtu & Minggu 12:30–14:00, berada setelah sesi 3", async ({ page }) => {
  for (const date of ["2026-11-28", "2026-11-29"]) {
    await page.goto(`/${date}`);
    await expect(page.getByTestId("break")).toHaveCount(1);
    await expect(page.getByTestId("break")).toContainText("12:30 – 14:00");
    const order = await page.locator("[data-testid=session-list] > li").evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-testid")),
    );
    expect(order).toEqual(["session-1", "session-2", "session-3", "break", "session-4", "session-5", "session-6"]);
  }
});

test("/admin tidak bisa diakses tanpa login", async ({ page, request }) => {
  for (const path of ["/admin", "/admin/tickets", "/admin/checkin"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/login/);
  }
  const res = await request.post("/api/admin/checkin", { data: { code: "JM-001-AAAA" } });
  expect(res.status()).toBe(401);
  const csv = await request.get("/api/admin/export?date=2026-11-27");
  expect(csv.status()).toBe(401);
});

test("admin: sekarang dipanggil tampil di layar publik, batalkan tiket membebaskan nomor", async ({ page }, testInfo) => {
  const seat = testInfo.project.name.startsWith("mobile") ? 80 : 81;
  const phone = testInfo.project.name.startsWith("mobile") ? "081355556666" : "081377778888";

  // Pesan satu tiket
  await page.goto("/2026-11-27");
  await page.getByTestId("session-3").getByRole("link").click();
  await page.getByTestId(`seat-${seat}`).click();
  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.getByLabel("Nama lengkap").fill("Akan Dibatalkan");
  await page.getByLabel("No. WhatsApp").fill(phone);
  await page.getByRole("button", { name: "Pesan tiket" }).click();
  await expect(page).toHaveURL(/\/ticket\//);
  const code = (await page.getByTestId("ticket-code").textContent())!.trim();

  // Login admin
  await page.goto("/admin");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  // Set nomor dipanggil → tampil di /display
  await page.getByLabel("Set nomor yang dipanggil untuk Jumat, 27 Nov").fill(String(seat));
  await page.getByLabel("Set nomor yang dipanggil untuk Jumat, 27 Nov").press("Enter");
  await page.goto("/display/2026-11-27");
  await expect(page.getByTestId("now-serving-number")).toHaveText(String(seat));

  // Batalkan tiket → nomor tersedia lagi
  await page.goto(`/admin/tickets?q=${code}`);
  await page.getByRole("button", { name: /Batalkan tiket/ }).click();
  await page.getByRole("button", { name: "Ya, batalkan" }).click();
  await expect(page.getByTestId(`row-${code}`)).toHaveCount(0);
  await page.goto("/2026-11-27");
  await page.getByTestId("session-3").getByRole("link").click();
  await expect(page.getByTestId(`seat-${seat}`)).toBeEnabled();
  await expect(page.getByTestId(`seat-${seat}`)).toHaveAttribute("data-status", "available");
});
