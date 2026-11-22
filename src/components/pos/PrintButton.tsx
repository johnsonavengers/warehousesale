"use client";
export function PrintButton({ label = "Cetak / simpan PDF" }: { label?: string }) {
  return <button className="btn-primary no-print" type="button" onClick={() => window.print()}>{label}</button>;
}
