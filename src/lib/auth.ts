/**
 * Satu akun admin dari ADMIN_EMAIL dan ADMIN_PASSWORD.
 * Cookie httpOnly terikat ke email dan password sehingga perubahan keduanya membatalkan sesi lama.
 * Memakai Web Crypto agar bisa dipakai di middleware (Edge) maupun route handler (Node).
 */
export const ADMIN_COOKIE = "admin_session";
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 12; // 12 jam

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function adminCredentials() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  return email && password?.trim() ? { email, password } : null;
}

/** Token sesi yang valid, atau null jika akun admin belum dikonfigurasi. */
export async function expectedAdminToken(): Promise<string | null> {
  const credentials = adminCredentials();
  if (!credentials) return null;
  return sha256Hex(`tiket-antrian:admin:v2:${JSON.stringify([credentials.email, credentials.password])}`);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function isValidAdminToken(token: string | undefined): Promise<boolean> {
  const expected = await expectedAdminToken();
  return !!expected && !!token && safeEqual(token, expected);
}

export async function checkAdminCredentials(email: string, password: string): Promise<boolean> {
  const credentials = adminCredentials();
  if (!credentials) return false;
  const emailMatches = safeEqual(
    await sha256Hex(email.trim().toLowerCase()),
    await sha256Hex(credentials.email),
  );
  const passwordMatches = safeEqual(await sha256Hex(password), await sha256Hex(credentials.password));
  return emailMatches && passwordMatches;
}
