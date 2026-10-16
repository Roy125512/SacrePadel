import type { Metadata } from "next";
import Link from "next/link";
import { listCoaches, type Coach } from "@/lib/classes";
import { listPublicEvents } from "@/lib/events";

export const metadata: Metadata = {
  title: "Clases de pádel",
  description: "Clases de pádel con entrenador en Sacré Pádel, Pátzcuaro: individuales, en pareja y clínicas grupales.",
};
export const dynamic = "force-dynamic";

const TZ = "America/Mexico_City";
const nowMs = () => Date.now();
const when = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

/** Clases: entrenadores (clase privada) y clínicas grupales próximas. */
export default async function ClasesPage() {
  const [coaches, events] = await Promise.all([
    listCoaches().catch((): Coach[] => []),
    listPublicEvents().catch(() => []),
  ]);
  const now = nowMs();
  const clinics = events.filter((e) => e.kind === "SOCIAL" && e.status === "OPEN" && new Date(e.starts_at).getTime() > now);

  return (
    <div className="page">
      <div className="mx-auto max-w-4xl px-6 pb-24 pt-28 sm:pt-32">
        <p className="text-[0.72rem] uppercase tracking-[0.3em] text-[var(--brand)]">Clases</p>
        <h1 className="font-display mt-5 text-5xl leading-[1.02] sm:text-6xl">
          Aprende <em>con</em> quien sabe.
        </h1>
        <p className="mt-5 max-w-xl leading-relaxed text-[var(--muted)]">
          Elige entrenador, día y hora: te apartamos la cancha. Clases individuales o en pareja, de 60 o 90 minutos.
        </p>

        {coaches.length === 0 ? (
          <p className="mt-12 border-y py-10 text-[var(--muted)]" style={{ borderColor: "var(--line)" }}>
            Muy pronto podrás reservar clases aquí. Mientras, pregunta en recepción.
          </p>
        ) : (
          <ul className="mt-12 grid gap-4 sm:grid-cols-2">
            {coaches.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/clases/${c.id}`}
                  className="block h-full border bg-[var(--surface)] p-5 transition-colors hover:border-[var(--brand)]"
                  style={{ borderColor: "var(--line)" }}
                >
                  <div className="flex items-center gap-4">
                    <span
                      className="font-display flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl text-white"
                      style={{ background: "var(--brand)" }}
                      aria-hidden
                    >
                      {c.name.slice(0, 1)}
                    </span>
                    <div>
                      <h2 className="font-display text-2xl leading-tight">{c.name}</h2>
                      <p className="text-sm text-[var(--muted)]">
                        Desde ${c.rate_individual}/h{c.rate_pair ? ` · pareja $${c.rate_pair}/h` : ""}
                      </p>
                    </div>
                  </div>
                  {c.bio && <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-[var(--muted)]">{c.bio}</p>}
                  <span className="mt-4 inline-block text-sm font-semibold underline underline-offset-4">Ver horarios</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {clinics.length > 0 && (
          <>
            <p className="mt-14 text-[0.72rem] uppercase tracking-[0.2em] text-[var(--muted)]">Clínicas grupales</p>
            <ul className="mt-3 divide-y border-y text-sm" style={{ borderColor: "var(--line)" }}>
              {clinics.map((e) => (
                <li key={e.id} style={{ borderColor: "var(--line)" }}>
                  <Link href={`/torneos/${e.id}`} className="flex flex-wrap justify-between gap-x-6 gap-y-1 py-3 hover:text-[var(--brand)]">
                    <span>
                      <span className="inline-block first-letter:uppercase">{when(e.starts_at)}</span> · {e.title}
                    </span>
                    <span className="text-[var(--muted)]">
                      {e.price > 0 ? `$${e.price}` : "Gratis"} · {Math.max(0, e.capacity - e.taken)} lugares
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
