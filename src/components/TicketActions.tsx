"use client";

import { useState } from "react";

export function TicketActions({
  code,
  shareText,
  baseUrl,
}: {
  code: string;
  shareText: string;
  baseUrl: string;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveImage() {
    const node = document.getElementById("ticket-card");
    if (!node) return;
    setSaving(true);
    setError(null);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(node, { pixelRatio: 2, backgroundColor: "#0d0b14" });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `tiket-${code}.png`;
      a.click();
    } catch {
      setError("Gagal menyimpan gambar. Coba screenshot layar sebagai alternatif.");
    } finally {
      setSaving(false);
    }
  }

  function shareWhatsApp() {
    const origin = baseUrl || window.location.origin;
    const link = `${origin.replace(/\/$/, "")}/ticket/${code}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText}\n${link}`)}`, "_blank", "noopener");
  }

  return (
    <div className="mx-auto mt-6 max-w-sm">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <button type="button" className="btn-primary whitespace-nowrap px-3" onClick={saveImage} disabled={saving}>
          {saving ? "Menyimpan…" : "Simpan sebagai gambar"}
        </button>
        <button type="button" className="btn-ghost whitespace-nowrap px-3" onClick={shareWhatsApp}>
          Bagikan ke WhatsApp
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
