/**
 * Validasi & normalisasi nomor HP Indonesia.
 * Menerima 08xx, 628xx, +628xx (boleh ada spasi/strip) → disimpan sebagai 08xx.
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, "");
  const m = digits.match(/^(?:\+?62|0)(8[1-9]\d{7,10})$/);
  return m ? `0${m[1]}` : null;
}

/** 081234567890 → 0812••••7890 */
export function maskPhone(phone: string): string {
  if (phone.length <= 8) return phone.replace(/.(?=.{2})/g, "•");
  return phone.slice(0, 4) + "•".repeat(phone.length - 8) + phone.slice(-4);
}

/** 08xx → 628xx (untuk link wa.me) */
export function toWhatsAppNumber(phone: string): string {
  return phone.startsWith("0") ? `62${phone.slice(1)}` : phone;
}
