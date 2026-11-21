"use client";
import { NavLink as Link } from "@/components/NavLink";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { DayOverview } from "@/lib/booking";
import { Icon } from "./Icon";
export function CheckoutForm({ day }: { day: Pick<DayOverview, "date" | "label"> }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [ticketReady, setTicketReady] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true); setError(null);
    let booked = false;
    try {
      const res = await fetch("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: day.date, name, phone, email }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Gagal membuat tiket. Coba lagi."); return; }
      booked = true;
      setTicketReady(true);
      router.replace(`/ticket/${data.code}?baru=1`);
    } catch { setError("Koneksi bermasalah. Periksa menu Cari tiket sebelum mencoba lagi."); }
    finally { if (!booked) { submitting.current = false; setBusy(false); } }
  }
  return <div className="mt-8 grid items-start gap-5 md:grid-cols-[.85fr_1.2fr]">
    <section className="card p-6" aria-label="Ringkasan pesanan">
      <span className="mb-5 grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon name="calendar" /></span>
      <p className="eyebrow">Tanggal kunjungan</p><p className="mt-2 text-2xl font-semibold tracking-tight text-primary">{day.label}</p><p className="mt-1 text-sm text-stone-300">2026</p>
      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4"><p className="flex items-center gap-2 text-sm font-medium"><Icon name="spark" className="h-4 w-4 text-primary" />Diacak otomatis</p><p className="mt-2 text-xs leading-relaxed text-stone-400">Sistem mengacak sesi yang masih tersedia, lalu memberikan nomor antrian kosong dalam sesi tersebut setelah pemesanan berhasil.</p></div>
      <p className="mt-4 text-xs leading-relaxed text-stone-300">Periksa jam sesi di tiket dan datang sesuai jadwal tersebut.</p><Link href="/#tanggal" className="mt-4 inline-flex min-h-11 items-center text-xs font-medium text-primary underline underline-offset-4">Ganti tanggal</Link>
    </section>
    <form onSubmit={submit} className="card space-y-5 p-5 sm:p-6" noValidate>
      <div><label htmlFor="name" className="label">Nama lengkap <span className="text-primary">*</span></label><input id="name" name="name" className="input" autoComplete="name" placeholder="Nama sesuai identitas" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div><label htmlFor="phone" className="label">No. WhatsApp <span className="text-primary">*</span></label><input id="phone" name="phone" className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="08xxxxxxxxxx" required aria-describedby="phone-help" value={phone} onChange={(e) => setPhone(e.target.value)} /><p id="phone-help" className="mt-2 text-xs leading-relaxed text-stone-400">Format 08xx atau +628xx. Satu tiket per nomor, per tanggal.</p></div>
      <div><label htmlFor="email" className="label">Email <span className="font-normal text-stone-400">(opsional)</span></label><input id="email" name="email" className="input" type="email" autoComplete="email" placeholder="nama@email.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      {error && <p role="alert" className="rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={busy}>{ticketReady ? "Membuka tiket…" : busy ? "Menyiapkan tiket…" : "Pesan tiket"}<Icon name="arrow" className="h-4 w-4" /></button>
      <p className="text-center text-[11px] leading-relaxed text-stone-400">Ketersediaan diperiksa saat pemesanan.<br />Simpan gambar atau bagikan ke WhatsApp-mu.</p>
    </form>
  </div>;
}
