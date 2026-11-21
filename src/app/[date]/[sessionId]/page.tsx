import { notFound, redirect } from "next/navigation";
import { getScheduleDay } from "@/config/schedule";

export default function LegacyDatePage({ params }: { params: { date: string } }) {
  if (!getScheduleDay(params.date)) notFound();
  redirect(`/checkout?date=${params.date}`);
}
