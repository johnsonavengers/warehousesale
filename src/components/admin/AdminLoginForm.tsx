"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export function AdminLoginForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login gagal");
        setBusy(false);
        return;
      }
      const next = params.get("next");
      // Hanya izinkan redirect internal ke area admin.
      window.location.assign(next && next.startsWith("/admin") ? next : "/admin");
    } catch {
      setError("Koneksi bermasalah. Coba lagi.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card mt-5 space-y-4 p-5">
      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Memeriksa…" : "Masuk"}
      </button>
    </form>
  );
}
