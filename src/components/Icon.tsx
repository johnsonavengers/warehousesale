type IconName = "arrow" | "calendar" | "ticket" | "check" | "spark" | "clock";
const paths: Record<IconName, React.ReactNode> = {
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="4" /><path d="M7 3v4m10-4v4M3 11h18m-13 5h2m4 0h2" /></>,
  ticket: <><path d="M20 8V5H4v3a4 4 0 0 1 0 8v3h16v-3a4 4 0 0 1 0-8Z" /><path d="M14 8v1m0 3v1m0 3v1" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  spark: <path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4Z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
};
export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>{paths[name]}</svg>;
}
