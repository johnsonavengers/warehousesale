import Link from "next/link";
import { BOOKING_RULES } from "@/config/event";
import { CheckoutForm } from "@/components/CheckoutForm";
import { PageShell } from "@/components/SiteHeader";
import { Stepper } from "@/components/Stepper";
import { getHold } from "@/lib/booking";

export const dynamic = "force-dynamic";
export const metadata = { title: "Isi data" };

export default async function CheckoutPage({ searchParams }: { searchParams: { hold?: string } }) {
  const hold = searchParams.hold ? await getHold(searchParams.hold) : null;

  return (
    <PageShell>
      <Stepper current={3} />
      <h1 className="text-2xl font-bold tracking-tight">Isi data pemesan</h1>
      {hold ? (
        <CheckoutForm hold={hold} holdMinutes={BOOKING_RULES.holdMinutes} />
      ) : (
        <div className="card mt-6 p-5">
          <p className="text-sm text-stone-300">
            Nomor belum dipilih atau waktu pengisian sudah habis. Silakan pilih nomor antrian lagi.
          </p>
          <Link href="/" className="btn-primary mt-4">
            Pilih tanggal
          </Link>
        </div>
      )}
    </PageShell>
  );
}
