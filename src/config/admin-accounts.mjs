import { z } from "zod";

const accountsSchema = z.array(z.object({
  email: z.string().trim().pipe(z.email()).transform((value) => value.toLowerCase()),
  password: z.string().refine((value) => Boolean(value.trim()) && value.trim() !== "ganti-password-ini"),
}).strict()).max(20);

/**
 * @param {string | undefined} raw
 * @param {string | undefined} primaryEmail
 * @returns {{ email: string, password: string }[]}
 */
export function parseAdditionalAdmins(raw, primaryEmail) {
  if (!raw?.trim()) return [];
  const message = "ADMIN_ACCOUNTS harus berupa array JSON akun dengan email unik dan password terisi, maksimal 20 akun / 4 KB. Jangan ulangi ADMIN_EMAIL.";
  try {
    if (new TextEncoder().encode(raw).length > 4096) throw new Error();
    const accounts = accountsSchema.parse(JSON.parse(raw));
    const emails = new Set(primaryEmail?.trim() ? [primaryEmail.trim().toLowerCase()] : []);
    for (const account of accounts) {
      if (emails.has(account.email)) throw new Error();
      emails.add(account.email);
    }
    return accounts;
  } catch {
    // Jangan tampilkan isi konfigurasi atau password pada log build.
    throw new Error(message);
  }
}
