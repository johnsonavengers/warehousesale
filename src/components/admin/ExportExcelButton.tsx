"use client";

import { useRef, useState } from "react";

export function ExportExcelButton({ href, className = "btn-primary" }: { href: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  async function download() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError(null);
    try {
      const response = await fetch(href, { cache: "no-store" });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Ekspor gagal. Silakan coba lagi.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "laporan-pendaftar.xlsx";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Koneksi bermasalah. Silakan coba lagi.");
    } finally {
      inFlight.current = false; setBusy(false);
    }
  }
  return <div><button type="button" className={className} onClick={download} disabled={busy} aria-busy={busy}>{busy ? "Menyiapkan Excel…" : "Ekspor Excel"}</button>{error && <p role="alert" className="mt-2 max-w-sm text-sm text-red-200">{error}</p>}</div>;
}
