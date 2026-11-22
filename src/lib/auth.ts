/**
 * Akun utama dari ADMIN_EMAIL/ADMIN_PASSWORD; akun tambahan dari ADMIN_ACCOUNTS.
 * Cookie httpOnly terikat ke masing-masing akun, sehingga perubahan satu akun
 * membatalkan sesinya tanpa mengeluarkan admin lain.
 * Memakai Web Crypto agar bisa dipakai di middleware (Edge) maupun route handler (Node).
 */
import { parseAdditionalAdmins } from "@/config/admin-accounts.mjs";

export const ADMIN_COOKIE = "admin_session";
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 12; // 12 jam

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function adminCredentials(): { email: string; password: string }[] {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const primary = email && password?.trim() ? [{ email, password }] : [];
  try {
    return [...primary, ...parseAdditionalAdmins(process.env.ADMIN_ACCOUNTS, email)];
  } catch {
    // Konfigurasi tambahan yang rusak tidak membuka akses atau menonaktifkan akun utama.
    // Build production akan menolaknya melalui predeploy-check.
    return primary;
  }
}

async function tokenFor(credentials: { email: string; password: string }): Promise<string> {
  return sha256Hex(`tiket-antrian:admin:v2:${JSON.stringify([credentials.email, credentials.password])}`);
}

/** Tanpa email, tetap mengembalikan token akun utama untuk kompatibilitas. */
export async function expectedAdminToken(email = process.env.ADMIN_EMAIL ?? ""): Promise<string | null> {
  const credentials = adminCredentials().find((account) => account.email === email.trim().toLowerCase());
  if (!credentials) return null;
  return tokenFor(credentials);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function isValidAdminToken(token: string | undefined): Promise<boolean> {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const expected = await Promise.all(adminCredentials().map(tokenFor));
  return expected.some((value) => safeEqual(token, value));
}

/** Identitas kasir berasal dari sesi server, bukan dari input transaksi. */
export async function adminEmailForToken(token: string | undefined): Promise<string | null> {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const accounts = adminCredentials();
  const tokens = await Promise.all(accounts.map(tokenFor));
  const index = tokens.findIndex((value) => safeEqual(token, value));
  return index >= 0 ? accounts[index].email : null;
}

export async function checkAdminCredentials(email: string, password: string): Promise<boolean> {
  const credentials = adminCredentials().find((account) => account.email === email.trim().toLowerCase());
  if (!credentials) return false;
  const emailMatches = safeEqual(
    await sha256Hex(email.trim().toLowerCase()),
    await sha256Hex(credentials.email),
  );
  const passwordMatches = safeEqual(await sha256Hex(password), await sha256Hex(credentials.password));
  return emailMatches && passwordMatches;
}
