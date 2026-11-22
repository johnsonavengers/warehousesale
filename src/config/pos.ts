/** Identitas cetak POS; terpisah dari pengaturan tiket. */
export const POS_STORE = {
  name: "Johnson Warehouse Sale",
  tagline: "#GayaGaPakeMahal",
  footer: "Terima kasih atas pembelian Anda. Simpan struk ini sebagai bukti pembelian.",
};

export const PAYMENT_LABELS = { CASH: "Tunai", QRIS: "QRIS", TRANSFER: "Transfer", DEBIT: "Debit" } as const;
export type PosPaymentMethod = keyof typeof PAYMENT_LABELS;

export function rupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

export type PosProductView = {
  id: string; sku: string; name: string; price: number; stock: number;
  active: boolean; revision: number; updatedAt: string;
};
