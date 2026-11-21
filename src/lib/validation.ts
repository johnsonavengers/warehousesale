import { z } from "zod";
import { normalizePhone } from "./phone";

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD");

export const phoneSchema = z
  .string({ error: "Nomor WhatsApp wajib diisi" })
  .transform((v, ctx) => {
    const p = normalizePhone(v);
    if (!p) {
      ctx.addIssue({
        code: "custom",
        message: "Nomor WhatsApp tidak valid. Gunakan format 08xx atau +628xx.",
      });
      return z.NEVER;
    }
    return p;
  });

export const createHoldSchema = z.object({
  sessionId: z.string({ error: "sessionId wajib diisi" }).min(1, "sessionId wajib diisi"),
  queueNumber: z
    .number({ error: "queueNumber harus berupa angka" })
    .int("queueNumber harus bilangan bulat")
    .positive("queueNumber harus positif"),
});

export const createTicketSchema = z.object({
  holdId: z.string({ error: "holdId wajib diisi" }).min(1, "holdId wajib diisi"),
  name: z
    .string({ error: "Nama wajib diisi" })
    .trim()
    .min(2, "Nama wajib diisi (minimal 2 karakter)")
    .max(80, "Nama terlalu panjang"),
  phone: phoneSchema,
  email: z
    .union([z.literal(""), z.email("Format email tidak valid")])
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
});

export const checkinSchema = z.object({
  code: z.string({ error: "Kode tiket wajib diisi" }).trim().min(1, "Kode tiket wajib diisi"),
  force: z.boolean().optional().default(false),
});

export const updateTicketSchema = z.object({
  status: z.enum(["BOOKED", "CHECKED_IN", "CANCELLED"], { error: "Status tidak valid" }),
});

export const nowServingSchema = z.object({
  date: dateSchema,
  number: z
    .number({ error: "Nomor harus berupa angka" })
    .int("Nomor harus bilangan bulat")
    .min(0, "Nomor tidak valid"),
});

export const loginSchema = z.object({
  email: z
    .string({ error: "Email wajib diisi" })
    .trim()
    .pipe(z.email("Format email tidak valid"))
    .transform((value) => value.toLowerCase()),
  password: z.string({ error: "Password wajib diisi" }).min(1, "Password wajib diisi"),
});
