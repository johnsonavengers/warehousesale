import { NavLink as Link } from "@/components/NavLink";
import { EVENT } from "@/config/event";
import { SCHEDULE } from "@/config/schedule";
import { Icon } from "@/components/Icon";
import { PageShell } from "@/components/SiteHeader";
import { Stepper } from "@/components/Stepper";
import { getDaysOverview } from "@/lib/booking";

export const dynamic = "force-dynamic";
const WEEKENDS = [
  { label: "27–29 November", dates: SCHEDULE.slice(0, 3) },
  { label: "4–6 Desember", dates: SCHEDULE.slice(3, 6) },
  { label: "11–13 Desember", dates: SCHEDULE.slice(6, 9) },
];
export default async function HomePage() {
  const days = await getDaysOverview();
  return <PageShell>
    <section className="relative grid items-center gap-8 pb-10 pt-2 md:grid-cols-[1.5fr_1fr] md:pb-14 md:pt-6">
      <div>
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1.5 text-[10px] font-semibold tracking-[.16em] text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary" />THE WAREHOUSE EDIT · 2026</p>
        <h1 className="text-[clamp(2.5rem,6vw,4.75rem)] font-semibold leading-[1.06] tracking-[-.055em]">Barang incaran.<br /><span className="text-primary">Giliran kamu.</span></h1>
        <p className="mt-5 max-w-sm text-sm leading-relaxed text-stone-300 sm:text-base">{EVENT.tagline} Datang sesuai jam di tiket, nikmati waktu belanjamu.</p>
        <a href="#tanggal" className="btn-primary mt-6">Pilih tanggal kunjungan <Icon name="arrow" className="h-4 w-4" /></a>
        <p className="mt-3 text-[11px] text-stone-400">9 hari pilihan · 3 akhir pekan · Kuota terbatas</p>
      </div>
      <div aria-hidden="true" className="relative hidden min-h-[310px] items-center justify-center md:flex">
        <div className="absolute h-60 w-60 rounded-full bg-primary/15 blur-[70px]" />
        <div className="absolute h-64 w-56 -rotate-12 rounded-[30px] border border-white/10 bg-white/[0.03]" />
        <div className="hero-pass glass relative w-64 rounded-[30px] p-6">
          <div className="flex items-center justify-between"><span className="text-xs font-bold tracking-[.15em]">JOHNSON</span><Icon name="spark" className="h-5 w-5 text-primary" /></div>
          <p className="mt-7 text-[10px] uppercase tracking-[.2em] text-stone-400">Your next great find</p><p className="mt-1 text-4xl font-semibold leading-[1.05] tracking-tight">See you<br /><span className="text-primary">at the sale.</span></p>
          <div className="mt-7 border-t border-dashed border-white/20 pt-4"><p className="text-[10px] tracking-[.15em] text-stone-400">NOV — DES 2026</p><div className="mt-2 flex items-center justify-between"><span className="text-sm font-medium">Your day. Your pass.</span><Icon name="ticket" className="text-primary h-5 w-5" /></div></div>
        </div>
      </div>
    </section>
    <section id="tanggal" className="scroll-mt-28 border-t border-white/10 pt-8">
      <Stepper current={0} />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Pilih tanggal</h2><p className="mt-2 text-sm text-stone-400">Satu tanggal, satu tiket. Sisanya kami siapkan.</p></div><span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-stone-300">November — Desember 2026</span></div>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          {WEEKENDS.map((weekend, index) => <section key={weekend.label} className="card p-3.5 sm:p-5" aria-label={weekend.label}>
            <div className="mb-4 flex items-center justify-between px-1"><div className="flex items-center gap-3"><span className="text-[10px] font-medium tracking-widest text-stone-400">0{index + 1}</span><h3 className="text-sm font-semibold">{weekend.label}</h3></div><span className="eyebrow text-[9px]">2026</span></div>
            <ul className="grid grid-cols-3 gap-2.5 sm:gap-3">{weekend.dates.map(({ date, label }) => {
              const day = days.find((d) => d.date === date);
              const disabled = !day || day.isPast || day.remaining === 0;
              const content = <><span className="text-[11px] font-medium text-stone-300">{label.split(",")[0]}</span><span className="my-2 text-[38px] font-medium leading-none tracking-tighter sm:text-5xl">{date.slice(-2)}</span><span className="text-[10px] text-stone-400">{date.slice(5, 7) === "11" ? "November" : "Desember"}</span><span className={"mt-3 text-[9px] font-medium sm:text-[11px] " + (disabled ? "text-stone-400" : "text-primary")}>{!day ? "Segera tersedia" : day.isPast ? "Sudah lewat" : !day.remaining ? "Kuota habis" : `${day.remaining} tiket tersisa`}</span></>;
              return <li key={date}>{disabled ? <div data-testid={`day-${date}`} aria-disabled="true" className="date-card opacity-50">{content}</div> : <Link href={`/checkout?date=${date}`} data-testid={`day-${date}`} aria-label={`Pilih ${label} 2026, ${day.remaining} tiket tersisa`} className="date-card">{content}</Link>}</li>;
            })}</ul>
          </section>)}
        </div>
        <aside className="card p-6 lg:sticky lg:top-28">
          <span className="mb-5 grid h-11 w-11 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><Icon name="ticket" /></span>
          <h3 className="text-lg font-semibold tracking-tight">Lebih simpel.<br />Tinggal datang.</h3>
          <ol className="mt-6 space-y-5">{[["Pilih tanggal", "Tentukan hari yang pas untukmu."], ["Lengkapi data", "Isi nama dan nomor WhatsApp aktif."], ["Simpan tiketmu", "Sesi dan nomor diacak otomatis, lalu tertera di tiket."]].map(([title, desc], i) => <li key={title} className="flex gap-3"><span className="mt-0.5 text-xs font-medium text-primary">0{i + 1}</span><div><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs leading-relaxed text-stone-400">{desc}</p></div></li>)}</ol>
          <div className="mt-6 border-t border-white/10 pt-5 text-xs leading-relaxed text-stone-400"><span className="text-white">Datang sesuai sesi di tiket.</span><br />Sesi dan nomor diacak dari kuota yang tersedia. Satu nomor WhatsApp untuk satu tiket per tanggal.</div>
        </aside>
      </div>
    </section>
  </PageShell>;
}
