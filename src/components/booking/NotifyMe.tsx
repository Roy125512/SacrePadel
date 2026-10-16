"use client";

import { useState } from "react";

/** Botón "Avísame si se abre un lugar" (partido o torneo lleno; requiere sesión). */
export function NotifyMeButton({ body, label = "Avísame si se abre un lugar" }: { body: Record<string, unknown>; label?: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  async function send() {
    setState("sending");
    try {
      const r = await fetch("/api/web/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg(j?.error ?? "No se pudo.");
        setState("idle");
        return;
      }
      setMsg(`Listo, te avisamos a ${j.email} si se abre un lugar.`);
      setState("done");
    } catch {
      setMsg("Sin conexión. Intenta de nuevo.");
      setState("idle");
    }
  }
  return (
    <div className="mt-4">
      {state !== "done" && (
        <button type="button" className="btn-secondary !px-4 !py-2 !text-[0.68rem]" onClick={send} disabled={state === "sending"}>
          {state === "sending" ? "Guardando…" : label}
        </button>
      )}
      {msg && <p className="mt-2 text-sm">{msg}</p>}
    </div>
  );
}

/**
 * En /reservar: si alguna hora del día está llena en todas las canchas, el
 * jugador puede pedir que le avisemos si se libera.
 */
export function NotifyMeSlot({ fullTimes, askEmail }: { fullTimes: { start_at: string; label: string }[]; askEmail: boolean }) {
  const [startAt, setStartAt] = useState(fullTimes[0]?.start_at ?? "");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  if (fullTimes.length === 0) return null;
  const chosen = fullTimes.some((t) => t.start_at === startAt) ? startAt : fullTimes[0].start_at;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    try {
      const r = await fetch("/api/web/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "SLOT", start_at: chosen, email: askEmail ? email.trim() : undefined }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg(j?.error ?? "No se pudo.");
        setState("idle");
        return;
      }
      setMsg(`Listo: si se libera una cancha a las ${fullTimes.find((t) => t.start_at === chosen)?.label}, te avisamos a ${j.email}.`);
      setState("done");
    } catch {
      setMsg("Sin conexión. Intenta de nuevo.");
      setState("idle");
    }
  }

  return (
    <form onSubmit={send} className="mt-6 rounded-lg border px-4 py-4 text-sm" style={{ borderColor: "rgba(120,46,21,0.14)", background: "var(--surface)" }}>
      <p className="font-semibold" style={{ color: "var(--foreground)" }}>¿Tu horario está lleno?</p>
      <p className="mt-1" style={{ color: "var(--muted)" }}>
        Te avisamos por correo si alguien cancela. Gana quien reserve primero.
      </p>
      {state === "done" ? (
        <p className="mt-3 font-medium">{msg}</p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            className="rounded border bg-white px-2 py-2 tabular-nums"
            style={{ borderColor: "var(--line)" }}
            value={chosen}
            onChange={(e) => setStartAt(e.target.value)}
            aria-label="Hora"
          >
            {fullTimes.map((t) => (
              <option key={t.start_at} value={t.start_at}>
                {t.label}
              </option>
            ))}
          </select>
          {askEmail && (
            <input
              className="input !w-56 !py-2"
              type="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          )}
          <button className="btn-primary !px-4 !py-2 !text-[0.68rem]" disabled={state === "sending"}>
            {state === "sending" ? "Guardando…" : "Avísame"}
          </button>
          {msg && <p className="w-full text-red-700">{msg}</p>}
        </div>
      )}
    </form>
  );
}
