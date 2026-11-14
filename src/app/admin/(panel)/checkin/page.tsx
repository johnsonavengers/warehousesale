import { CheckinClient } from "@/components/admin/CheckinClient";

export const metadata = { title: "Check-in" };

export default function AdminCheckinPage() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold tracking-tight">Check-in</h1>
      <p className="mt-1 text-sm text-stone-400">
        Pindai QR pada e-tiket pengunjung, atau ketik kode tiket secara manual.
      </p>
      <CheckinClient />
    </div>
  );
}
