"use client";

import { useState } from "react";
import { formatMXN } from "@/lib/config";

/** Formulario para pagar una o varias partes con Mercado Pago. */
export default function SplitPayForm({
  token,
  shareAmounts,
}: {
  token: string;
  /** Montos de las partes pendientes, en orden. */
  shareAmounts: number[];
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [count, setCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const max = Math.min(3, shareAmounts.length);
  const total = shareAmounts.slice(0, count).reduce((a, n) => a + n, 0);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Escribe tu nombre para que sepan quién pagó.");
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/web/split/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, count, name: name.trim(), email: email.trim() || undefined }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.init_point) {
        setError(j?.error ?? "No se pudo iniciar el pago.");
        setLoading(false);
        return;
      }
      window.location.href = j.init_point;
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={pay} className="mt-8 space-y-4">
      <div>
        <label className="block text-sm font-medium text-[var(--muted)]" htmlFor="sp-name">
          Tu nombre
        </label>
        <input
          id="sp-name"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Como te conocen en el grupo"
          autoComplete="name"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--muted)]" htmlFor="sp-email">
          Correo (opcional, para tu recibo)
        </label>
        <input
          id="sp-email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com"
          inputMode="email"
          autoComplete="email"
        />
      </div>
      {max > 1 && (
        <div>
          <div className="text-sm font-medium text-[var(--muted)]">¿Cuántas partes pagas?</div>
          <div className="mt-2 flex gap-2">
            {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCount(n)}
                className={`${count === n ? "btn-primary" : "btn-secondary"} !px-4 !py-2`}
                aria-pressed={count === n}
              >
                {n === 1 ? "Solo la mía" : `${n} partes`}
              </button>
            ))}
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="border-l-2 border-red-700 pl-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary w-full !py-3.5" disabled={loading}>
        {loading ? "Preparando el pago…" : `Pagar ${formatMXN(total)} MXN`}
      </button>
      <p className="text-xs leading-relaxed text-[var(--muted)]">
        Pagas con tarjeta o transferencia en Mercado Pago. No necesitas cuenta.
      </p>
    </form>
  );
}
