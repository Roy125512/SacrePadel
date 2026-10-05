"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ymdInBusinessTZ, hhmmInBusinessTZ } from "@/lib/businessTime";

type Slot = { start_at: string; can_start?: boolean };
type Court = { court_id: string; slots: Slot[] };

/**
 * "Hoy hay lugar": los próximos horarios en los que se puede empezar a jugar
 * hoy en al menos una cancha — datos reales de /api/web/availability.
 */
export default function TodayAvailability({ dark = false }: { dark?: boolean }) {
  const [times, setTimes] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/web/availability?date=${ymdInBusinessTZ()}`, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j: { availability?: Court[] }) => {
        if (cancelled) return;
        const free = new Set<string>();
        for (const c of j?.availability ?? []) {
          for (const s of c.slots) if (s.can_start) free.add(s.start_at);
        }
        setTimes([...free].sort().slice(0, 8).map((iso) => hhmmInBusinessTZ(iso)));
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const muted = dark ? "rgba(243,233,221,.7)" : "var(--muted)";

  // Si no se pudo consultar, no se inventa un "no hay lugar": solo se
  // invita a ver los horarios.
  if (failed) {
    return (
      <Link
        href="/reservar"
        className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] underline underline-offset-[8px]"
        style={{ color: dark ? "var(--brand-highlight)" : "var(--brand)" }}
      >
        Ver horarios disponibles
      </Link>
    );
  }

  const fg = dark ? "var(--dark-foreground)" : "var(--foreground)";
  const line = dark ? "rgba(241,236,227,.18)" : "var(--line)";

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <span className="text-[0.72rem] font-semibold uppercase tracking-[0.24em]" style={{ color: dark ? "var(--brand-highlight)" : "var(--brand)" }}>
        {times === null ? "Consultando…" : times.length > 0 ? "Libre hoy" : "Por hoy ya no hay horarios"}
      </span>
      {times && times.length > 0 && (
        <div className="flex flex-wrap items-center">
          {times.map((t, i) => (
            <Link
              key={t}
              href="/reservar"
              className="px-3 py-1 text-sm tabular-nums transition hover:opacity-100"
              style={{ color: fg, opacity: 0.85, borderLeft: i === 0 ? "none" : `1px solid ${line}` }}
            >
              {t}
            </Link>
          ))}
        </div>
      )}
      {times && times.length === 0 && (
        <Link href="/reservar" className="text-sm underline underline-offset-4" style={{ color: muted }}>
          Ver mañana
        </Link>
      )}
    </div>
  );
}
