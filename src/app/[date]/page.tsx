import { notFound } from "next/navigation";
import { getScheduleDay } from "@/config/schedule";
import { getSessionsForDay } from "@/lib/booking";
import { PageShell } from "@/components/SiteHeader";
import { Stepper } from "@/components/Stepper";
import { SessionPicker } from "@/components/SessionPicker";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pilih jam kunjungan" };
export default async function DatePage({ params, searchParams }: { params: { date: string }; searchParams: { pilih?: string } }) {
  if (!getScheduleDay(params.date)) notFound();
  const day = await getSessionsForDay(params.date);
  if (!day) notFound();
  return <PageShell><div className="mx-auto max-w-3xl"><Stepper current={1} /><SessionPicker initialDay={day} needsSelection={searchParams.pilih === "1"} /></div></PageShell>;
}
