/**
 * Autentikasi admin sederhana: cookie httpOnly berisi hash dari ADMIN_PASSWORD.
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

/** Token sesi yang valid, atau null jika ADMIN_PASSWORD belum di-set. */
export async function expectedAdminToken(): Promise<string | null> {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null;
  return sha256Hex(`tiket-antrian:admin:${pw}`);
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

export async function checkAdminPassword(password: string): Promise<boolean> {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return false;
  return safeEqual(await sha256Hex(password), await sha256Hex(pw));
}
