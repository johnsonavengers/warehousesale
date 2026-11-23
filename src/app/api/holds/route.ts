import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Pilih tanggal dan jam kunjungan. Nomor antrian diberikan otomatis setelah pendaftaran." }, { status: 410 });
}
