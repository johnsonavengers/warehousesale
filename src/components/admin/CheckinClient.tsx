"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TicketView } from "@/lib/booking";

type Outcome =
  | { kind: "ok"; ticket: TicketView }
  | { kind: "already" | "wrong_date" | "wrong_session"; ticket: TicketView; message: string }
  | { kind: "not_found" | "error"; message: string; code?: string };

const READER_ID = "qr-reader";

export function CheckinClient() {
  const [code, setCode] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null);
  const lastScan = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const busyRef = useRef(false);

  const submit = useCallback(async (rawCode: string, force = false) => {
    const value = rawCode.trim();
    if (!value || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: value, force }),
      });
      const data = await res.json();
      if (res.ok) {
        setOutcome({ kind: "ok", ticket: data.ticket });
        setCode("");
      } else if (data.result === "already" || data.result === "wrong_date" || data.result === "wrong_session") {
        setOutcome({ kind: data.result, ticket: data.ticket, message: data.error });
      } else if (res.status === 404) {
        setOutcome({ kind: "not_found", message: data.error, code: value });
      } else {
        setOutcome({ kind: "error", message: data.error ?? "Terjadi kesalahan." });
      }
    } catch {
      setOutcome({ kind: "error", message: "Koneksi bermasalah. Coba lagi." });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const stopScanner = useCallback(async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    setScanning(false);
    if (s) {
      try {
        await s.stop();
        s.clear();
      } catch {
        /* sudah berhenti */
      }
    }
  }, []);

  async function startScanner() {
    setCamError(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(READER_ID);
      scannerRef.current = scanner;
      setScanning(true);
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded: string) => {
          // Abaikan pembacaan berulang dari QR yang sama dalam 4 detik.
          const now = Date.now();
          if (decoded === lastScan.current.code && now - lastScan.current.at < 4000) return;
          lastScan.current = { code: decoded, at: now };
          submit(decoded);
        },
        () => {},
      );
    } catch {
      scannerRef.current = null;
      setScanning(false);
      setCamError(
        "Kamera tidak bisa diakses. Izinkan akses kamera (perlu HTTPS), atau gunakan input kode manual.",
      );
    }
  }

  useEffect(() => () => void stopScanner(), [stopScanner]);

  return (
    <div className="mt-6 space-y-5">
      <section className="card p-5" aria-label="Pindai QR">
        <div id={READER_ID} className={scanning ? "overflow-hidden rounded-xl bg-black" : "hidden"} />
        <div className={scanning ? "mt-3" : ""}>
          {scanning ? (
            <button type="button" className="btn-ghost w-full" onClick={stopScanner}>
              Matikan kamera
            </button>
          ) : (
            <button type="button" className="btn-primary w-full" onClick={startScanner}>
              Pindai QR dengan kamera
            </button>
          )}
        </div>
        {camError && (
          <p role="alert" className="mt-3 text-sm text-orange-300">
            {camError}
          </p>
        )}
      </section>

      <form
        className="card flex items-end gap-2.5 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit(code);
        }}
      >
        <div className="flex-1">
          <label htmlFor="checkin-code" className="label">
            Kode tiket
          </label>
          <input
            id="checkin-code"
            className="input font-mono uppercase"
            placeholder="JM-027-X7K2"
            autoComplete="off"
            autoCapitalize="characters"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary" disabled={busy || !code.trim()}>
          {busy ? "Memeriksa…" : "Check-in"}
        </button>
      </form>

      <div aria-live="assertive">
        {outcome && <OutcomePanel outcome={outcome} busy={busy} onForce={(c) => submit(c, true)} />}
      </div>
    </div>
  );
}

function TicketSummary({ ticket }: { ticket: TicketView }) {
  return (
    <div className="mt-3 flex items-center gap-4">
      <span className="queue-number text-6xl">{ticket.queueNumber}</span>
      <div className="min-w-0 text-sm">
        <p className="truncate text-base font-bold">{ticket.name}</p>
        <p>
          {ticket.dayLabel} · Sesi {ticket.session.order} ({ticket.session.startTime}–
          {ticket.session.endTime} WIB)
        </p>
        <p className="font-mono opacity-80">{ticket.code}</p>
      </div>
    </div>
  );
}

function OutcomePanel({
  outcome,
  busy,
  onForce,
}: {
  outcome: Outcome;
  busy: boolean;
  onForce: (code: string) => void;
}) {
  if (outcome.kind === "ok") {
    return (
      <div data-testid="checkin-result" data-result="ok" className="rounded-2xl border-2 border-emerald-400 bg-emerald-400/10 p-5 text-emerald-100">
        <p className="text-lg font-bold">✅ Valid — check-in berhasil</p>
        <TicketSummary ticket={outcome.ticket} />
      </div>
    );
  }
  if (outcome.kind === "already" || outcome.kind === "wrong_date" || outcome.kind === "wrong_session") {
    const title =
      outcome.kind === "already"
        ? "⚠️ Sudah check-in"
        : outcome.kind === "wrong_date"
          ? "⚠️ Salah tanggal"
          : "⚠️ Salah sesi";
    return (
      <div data-testid="checkin-result" data-result={outcome.kind} className="rounded-2xl border-2 border-amber-400 bg-amber-400/10 p-5 text-amber-100">
        <p className="text-lg font-bold">{title}</p>
        <p className="mt-1 text-sm">{outcome.message}</p>
        <TicketSummary ticket={outcome.ticket} />
        {outcome.kind !== "already" && (
          <button
            type="button"
            className="btn-ghost mt-4"
            disabled={busy}
            onClick={() => onForce(outcome.ticket.code)}
          >
            Tetap check-in
          </button>
        )}
      </div>
    );
  }
  return (
    <div data-testid="checkin-result" data-result={outcome.kind} className="rounded-2xl border-2 border-red-400 bg-red-500/10 p-5 text-red-100">
      <p className="text-lg font-bold">
        {outcome.kind === "not_found" ? "❌ Tiket tidak ditemukan" : "❌ Gagal"}
      </p>
      <p className="mt-1 text-sm">{outcome.message}</p>
    </div>
  );
}
