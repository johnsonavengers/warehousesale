import { notFound } from "next/navigation";
import { EVENT } from "@/config/event";
import { NowServingDisplay } from "@/components/NowServingDisplay";
import { getNowServing } from "@/lib/booking";
import { isValidDateString } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sekarang dipanggil" };

export default async function DisplayPage({ params }: { params: { date: string } }) {
  if (!isValidDateString(params.date)) notFound();
  const initial = await getNowServing(params.date);
  if (!initial) notFound();
  return <NowServingDisplay initial={initial} eventName={EVENT.name} />;
}
