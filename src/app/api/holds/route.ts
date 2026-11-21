import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Pemesanan kini cukup memilih tanggal. Silakan kembali ke halaman utama." }, { status: 410 });
}
