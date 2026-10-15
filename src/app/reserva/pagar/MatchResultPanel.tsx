"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatLevel, parseSets, RESULT_WINDOW_DAYS } from "@/lib/levels-shared";

type Player = { id: string; name: string; level: number | null };
type Result = {
  team_a: string[];
  team_b: string[];
  sets: number[][];
  status: "PENDING" | "CONFIRMED" | "REJECTED";
  submitted_by: string;
  level_changes: Record<string, { before: number; after: number }> | null;
};

const GAMES = [0, 1, 2, 3, 4, 5, 6, 7];

/**
 * Resultado de un partido competitivo: capturarlo, confirmarlo (la pareja
 * contraria) y ver cómo cambió el nivel de cada quien.
 */
export default function MatchResultPanel({
  token,
  meId,
  players,
  result,
  submitBlock,
}: {
  token: string;
  meId: string | null;
  players: Player[];
  result: Result | null;
  /** Por qué el usuario actual no puede capturar (null = sí puede). */
  submitBlock: string | null;
}) {
  const router = useRouter();
  const [partner, setPartner] = useState<string | null>(null);
  const [sets, setSets] = useState<(number | "")[][]>([
    ["", ""],
    ["", ""],
    ["", ""],
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = (id: string) => players.find((p) => p.id === id)?.name ?? "Jugador";
  const team = (ids: string[]) => ids.map(name).join(" y ");

  async function post(url: string, body: unknown) {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setError(j?.error ?? "No se pudo.");
      else router.refresh();
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    if (!partner) return setError("Elige quién fue tu pareja.");
    const filled = sets.filter(([a, b]) => a !== "" && b !== "").map(([a, b]) => [Number(a), Number(b)]);
    const check = parseSets(filled);
    if ("error" in check) return setError(check.error);
    void post("/api/web/match-result", { token, partner_id: partner, sets: filled });
  }

  // ===== Ya hay resultado (pendiente o confirmado) =====
  if (result && result.status !== "REJECTED") {
    const iReview = !!meId && result.team_b.includes(meId) && result.status === "PENDING";
    return (
      <div className="mt-10 border-t pt-6" style={{ borderColor: "var(--line)" }}>
        <p className="text-[0.72rem] uppercase tracking-[0.2em] text-[var(--muted)]">Resultado</p>
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
          <span className="font-semibold">{team(result.team_a)}</span>
          <span className="tabular-nums">{result.sets.map(([a]) => a).join("  ")}</span>
          <span className="font-semibold">{team(result.team_b)}</span>
          <span className="tabular-nums">{result.sets.map(([, b]) => b).join("  ")}</span>
        </div>

        {result.status === "PENDING" ? (
          iReview ? (
            <div className="mt-5">
              <p className="text-sm">{name(result.submitted_by)} capturó este resultado. ¿Es correcto?</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button type="button" className="btn-primary !px-4 !py-2 !text-[0.68rem]" disabled={busy} onClick={() => post("/api/web/match-result/review", { token, accept: true })}>
                  Sí, confirmar
                </button>
                <button type="button" className="btn-secondary !px-4 !py-2 !text-[0.68rem]" disabled={busy} onClick={() => post("/api/web/match-result/review", { token, accept: false })}>
                  No es correcto
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--muted)]">
              Esperando que la pareja contraria lo confirme (tienen {RESULT_WINDOW_DAYS} días después del partido).
            </p>
          )
        ) : (
          result.level_changes && (
            <ul className="mt-5 space-y-1.5 text-sm">
              {[...result.team_a, ...result.team_b].map((id) => {
                const c = result.level_changes![id];
                if (!c) return null;
                const d = c.after - c.before;
                return (
                  <li key={id} className="flex justify-between gap-4">
                    <span>
                      {name(id)}
                      {id === meId ? <span className="text-[var(--muted)]"> (tú)</span> : null}
                    </span>
                    <span className="tabular-nums">
                      {formatLevel(c.before)} → <b>{formatLevel(c.after)}</b>{" "}
                      <span style={{ color: d >= 0 ? "rgb(4,120,87)" : "rgb(153,27,27)" }}>
                        ({d >= 0 ? "+" : ""}
                        {d.toFixed(2)})
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )
        )}
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      </div>
    );
  }

  // ===== Capturar resultado =====
  if (submitBlock) {
    return result?.status === "REJECTED" || !meId ? null : (
      <p className="mt-10 border-t pt-6 text-sm text-[var(--muted)]" style={{ borderColor: "var(--line)" }}>
        {submitBlock}
      </p>
    );
  }

  const others = players.filter((p) => p.id !== meId);
  return (
    <div className="mt-10 border-t pt-6" style={{ borderColor: "var(--line)" }}>
      <p className="text-[0.72rem] uppercase tracking-[0.2em] text-[var(--muted)]">Resultado</p>
      {result?.status === "REJECTED" && (
        <p className="mt-2 text-sm text-amber-700">La pareja contraria rechazó el resultado anterior. Captúralo de nuevo.</p>
      )}
      <p className="mt-3 text-sm">¿Quién fue tu pareja?</p>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Tu pareja">
        {others.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={partner === p.id}
            onClick={() => setPartner(p.id)}
            className="rounded-full border px-3 py-1.5 text-sm"
            style={{
              borderColor: partner === p.id ? "var(--brand)" : "var(--line)",
              background: partner === p.id ? "var(--brand)" : "transparent",
              color: partner === p.id ? "#fff" : "var(--foreground)",
            }}
          >
            {p.name}
          </button>
        ))}
      </div>

      <p className="mt-5 text-sm">Marcador (juegos de tu pareja – juegos rivales)</p>
      <div className="mt-2 space-y-2">
        {sets.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="w-14 text-[var(--muted)]">Set {i + 1}</span>
            {[0, 1].map((side) => (
              <select
                key={side}
                aria-label={`Set ${i + 1} ${side === 0 ? "tu pareja" : "rivales"}`}
                className="rounded border bg-white px-2 py-1 tabular-nums"
                style={{ borderColor: "var(--line)" }}
                value={s[side]}
                onChange={(e) =>
                  setSets((prev) =>
                    prev.map((row, ri) => (ri === i ? row.map((v, si) => (si === side ? (e.target.value === "" ? "" : Number(e.target.value)) : v)) : row))
                  )
                }
              >
                <option value="">–</option>
                {GAMES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            ))}
            {i === 2 && <span className="text-xs text-[var(--muted)]">si hubo</span>}
          </div>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      <button type="button" className="btn-primary mt-5" onClick={submit} disabled={busy}>
        {busy ? "Guardando…" : "Enviar resultado"}
      </button>
      <p className="mt-2 text-xs text-[var(--muted)]">La pareja contraria lo confirma y entonces se ajusta el nivel de los 4.</p>
    </div>
  );
}
