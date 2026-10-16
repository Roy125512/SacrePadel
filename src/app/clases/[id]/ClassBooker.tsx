"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addDaysToYMD, hhmmInBusinessTZ, ymdInBusinessTZ, weekdayOfYMD } from "@/lib/businessTime";

const DAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** Elegir día, duración, tipo y hora de la clase, y reservarla. */
export default function ClassBooker({
  coachId,
  rateIndividual,
  ratePair,
  workDays,
  loggedIn,
}: {
  coachId: string;
  rateIndividual: number;
  ratePair: number | null;
  /** Días de la semana en que da clases (0 = domingo). */
  workDays: number[];
  loggedIn: boolean;
}) {
  const router = useRouter();
  const days = useMemo(() => {
    const today = ymdInBusinessTZ(new Date());
    return Array.from({ length: 14 }, (_, i) => addDaysToYMD(today, i)).filter((d) => workDays.includes(weekdayOfYMD(d)));
  }, [workDays]);
  const [date, setDate] = useState(days[0] ?? "");
  const [minutes, setMinutes] = useState(60);
  const [type, setType] = useState<"INDIVIDUAL" | "PAIR">("INDIVIDUAL");
  const [times, setTimes] = useState<string[] | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!date) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/web/classes/slots?coach=${coachId}&date=${date}&minutes=${minutes}`, { cache: "no-store" });
        const j = await r.json();
        if (alive) {
          setTimes(j.times ?? []);
          setTime(null);
        }
      } catch {
        if (alive) setTimes([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [coachId, date, minutes]);

  const price = Math.round(((type === "PAIR" ? (ratePair ?? 0) : rateIndividual) * minutes) / 60);

  async function book(pay: "ONLINE" | "CLUB") {
    if (!time) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/web/classes/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coach_id: coachId, start_at: time, minutes, type, pay }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg({ ok: false, text: j?.error ?? "No se pudo reservar." });
        setBusy(false);
        return;
      }
      if (j.init_point) {
        window.location.href = j.init_point;
        return;
      }
      setMsg({ ok: true, text: "¡Listo! Tu clase quedó reservada; pagas en recepción. Te mandamos la confirmación por correo." });
      setBusy(false);
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "Sin conexión. Intenta de nuevo." });
      setBusy(false);
    }
  }

  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm transition-colors ${on ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] hover:border-[var(--brand)]"}`;

  if (days.length === 0) return <p className="mt-8 text-[var(--muted)]">Por ahora no tiene horarios de clase.</p>;

  return (
    <div className="mt-10 space-y-6">
      <div>
        <p className="text-[0.72rem] uppercase tracking-[0.2em] text-[var(--muted)]">Día</p>
        <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
          {days.map((d) => (
            <button key={d} type="button" className={`${chip(d === date)} shrink-0 tabular-nums`} onClick={() => setDate(d)}>
              {DAYS[weekdayOfYMD(d)]} {Number(d.slice(8))}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-6">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.2em] text-[var(--muted)]">Duración</p>
          <div className="mt-2 flex gap-2">
            {[60, 90].map((m) => (
              <button key={m} type="button" className={chip(minutes === m)} onClick={() => setMinutes(m)}>
                {m} min
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.2em] text-[var(--muted)]">Alumnos</p>
          <div className="mt-2 flex gap-2">
            <button type="button" className={chip(type === "INDIVIDUAL")} onClick={() => setType("INDIVIDUAL")}>
              Individual
            </button>
            {ratePair && (
              <button type="button" className={chip(type === "PAIR")} onClick={() => setType("PAIR")}>
                En pareja
              </button>
            )}
          </div>
        </div>
      </div>
      <div>
        <p className="text-[0.72rem] uppercase tracking-[0.2em] text-[var(--muted)]">Hora</p>
        {times === null ? (
          <p className="mt-2 text-sm text-[var(--muted)]">Buscando horarios…</p>
        ) : times.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">No hay horarios libres ese día. Prueba otro.</p>
        ) : (
          <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
            {times.map((t) => (
              <button key={t} type="button" className={`${chip(time === t)} tabular-nums`} onClick={() => setTime(t)}>
                {hhmmInBusinessTZ(t)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-6" style={{ borderColor: "var(--line)" }}>
        <div>
          <span className="font-display text-4xl tabular-nums">${price}</span>
          <span className="text-sm text-[var(--muted)]"> MXN {type === "PAIR" ? "(los dos)" : ""}</span>
          <p className="text-xs text-[var(--muted)]">Incluye la cancha. Cancelación sin costo hasta 24 h antes.</p>
        </div>
        {loggedIn ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={!time || busy} onClick={() => book("ONLINE")}>
              {busy ? "Un momento…" : "Pagar en línea"}
            </button>
            <button type="button" className="btn-secondary" disabled={!time || busy} onClick={() => book("CLUB")}>
              Pagar en recepción
            </button>
          </div>
        ) : (
          <a href={`/login?next=${encodeURIComponent(`/clases/${coachId}`)}`} className="btn-primary">
            Inicia sesión para reservar
          </a>
        )}
      </div>
      {msg && (
        <p role="status" className={`border-l-2 pl-3 text-sm ${msg.ok ? "border-[var(--brand)] font-medium" : "border-red-700 text-red-700"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
