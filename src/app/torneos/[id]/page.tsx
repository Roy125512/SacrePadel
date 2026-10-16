import type { Metadata } from "next";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@/lib/supabaseServer";
import { mpPayment } from "@/lib/mercadopago";
import { mxParts } from "@/lib/bookingNotifications";
import { EVENT_KIND_LABEL, EVENT_REF_PREFIX, activeRegistrations, finalizeEventPayment, getEvent } from "@/lib/events";
import { americanaStandings } from "@/lib/americana";
import { joinBlock } from "@/lib/openMatches";
import { formatLevel } from "@/lib/levels-shared";
import {
  CANCEL_NOTICE_HOURS,
  MATCH_GENDER_LABEL,
  levelRangeLabel,
  withinCancelWindow,
  type MatchGender,
} from "@/lib/config";
import { DEMO } from "@/lib/demo/flag";
import { RegisterButton, CancelRegistrationButton } from "./EventActions";
import AddToCalendar from "@/components/booking/AddToCalendar";
import ShareSplitLink from "@/components/booking/ShareSplitLink";
import { NotifyMeButton } from "@/components/booking/NotifyMe";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const nowMs = () => Date.now();
const first = (s: string | null | undefined) => (s ?? "").trim().split(/\s+/)[0] || "Jugador";

type Params = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const ev = UUID.test(id) ? await getEvent(id) : null;
  return ev
    ? { title: ev.title, description: `${EVENT_KIND_LABEL[ev.kind]} en Sacré Pádel, Pátzcuaro. Inscríbete en línea.` }
    : { title: "Evento", robots: { index: false } };
}

/** Página de un torneo o americana: información, inscripción, rondas y tabla. */
export default async function EventoPage({ params, searchParams }: Params) {
  const { id } = await params;
  const sp = await searchParams;
  const ev = UUID.test(id) ? await getEvent(id) : null;

  if (!ev) {
    return (
      <div className="page">
        <div className="mx-auto max-w-xl px-6 pb-24 pt-28 sm:pt-32">
          <h1 className="font-display text-4xl">No encontramos este evento.</h1>
          <Link href="/torneos" className="mt-6 inline-block underline underline-offset-4">
            Ver torneos y americanas
          </Link>
        </div>
      </div>
    );
  }

  // Regreso de Mercado Pago.
  let flash: string | null = null;
  const status = sp.status ?? sp.collection_status;
  const paymentId = sp.payment_id ?? sp.collection_id;
  if (status && sp.external_reference?.startsWith(EVENT_REF_PREFIX)) {
    if (status === "approved" && paymentId && paymentId !== "null" && !DEMO) {
      try {
        const payment = await mpPayment.get({ id: paymentId });
        if (payment.external_reference === sp.external_reference) {
          const r = await finalizeEventPayment(payment);
          flash = r.ok ? "¡Listo, ya estás inscrito!" : "Ya no había lugar o el evento cambió: te devolvimos tu pago.";
        }
      } catch {
        flash = "Tu pago fue aprobado; en unos momentos se verá tu inscripción.";
      }
    } else if (status !== "approved") flash = "El pago no se completó. Puedes intentar de nuevo.";
  }

  const regs = await activeRegistrations(ev.id);
  const confirmed = regs.filter((r) => r.status === "CONFIRMED");
  const ids = confirmed.map((r) => r.user_id);
  const { data: profs } = ids.length
    ? await supabaseAdmin.from("profiles").select("id, full_name, level, division").in("id", ids)
    : { data: [] as { id: string; full_name: string | null; level: number | null; division: string | null }[] };
  const prof = new Map((profs ?? []).map((p) => [p.id, p]));
  // Solo el nombre del perfil: player_name puede venir del correo y aquí es público.
  const nameOf = (uid: string) => first(prof.get(uid)?.full_name);

  let me: { id: string; sex: string | null; division: string | null; level: number | null } | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data?.user) {
      const { data: p } = await supabaseAdmin.from("profiles").select("sex, division, level").eq("id", data.user.id).maybeSingle();
      me = { id: data.user.id, sex: p?.sex ?? null, division: p?.division ?? null, level: p?.level ?? null };
    }
  } catch {}
  const myReg = me ? confirmed.find((r) => r.user_id === me!.id) : undefined;

  const s = mxParts(ev.starts_at);
  const e = mxParts(ev.ends_at);
  const now = nowMs();
  const started = new Date(ev.starts_at).getTime() <= now;
  const full = regs.length >= ev.capacity;
  const pair = ev.entry === "PAIR";
  const standings = ev.rounds ? americanaStandings(ids, ev.rounds) : [];
  const url = `${SITE.url}/torneos/${ev.id}`;

  return (
    <div className="page">
      <div className="mx-auto max-w-3xl px-6 pb-24 pt-28 sm:pt-32">
        <Link href="/torneos" className="text-sm text-[var(--muted)] underline underline-offset-4">
          ← Torneos y americanas
        </Link>
        <p className="mt-6 text-[0.72rem] uppercase tracking-[0.3em] text-[var(--brand)]">
          {EVENT_KIND_LABEL[ev.kind]}
          {ev.status === "CANCELLED" ? " · Cancelado" : ev.status === "FINISHED" ? " · Terminado" : ""}
        </p>
        <h1 className="font-display mt-4 text-5xl leading-[1.02] sm:text-6xl">{ev.title}</h1>
        <p className="mt-4 text-lg first-letter:uppercase">
          {new Date(ev.starts_at).toLocaleDateString("es-MX", { timeZone: "America/Mexico_City", weekday: "long", day: "numeric", month: "long" })}
          , {s.timeLocal}–{e.timeLocal}
        </p>
        <ul className="mt-5 flex flex-wrap gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.16em]">
          {[
            levelRangeLabel(ev.level_min, ev.level_max),
            MATCH_GENDER_LABEL[(ev.gender ?? "ANY") as MatchGender],
            ev.price > 0 ? `$${ev.price} ${pair ? "por pareja" : "por persona"}` : "Gratis",
            pair ? "Por parejas" : "Individual",
          ].map((t) => (
            <li key={t} className="border px-2.5 py-1" style={{ borderColor: "var(--line)" }}>
              {t}
            </li>
          ))}
        </ul>
        {ev.description && <p className="mt-6 max-w-xl whitespace-pre-line leading-relaxed text-[var(--muted)]">{ev.description}</p>}
        {ev.kind === "AMERICANA" && !ev.description && (
          <p className="mt-6 max-w-xl leading-relaxed text-[var(--muted)]">
            Te inscribes solo: en cada ronda juegas con una pareja distinta contra rivales distintos. Sumas los puntos que haga
            tu pareja en cada partido y gana quien termine con más.
          </p>
        )}

        {flash && <p role="status" className="mt-6 border-l-2 border-[var(--brand)] pl-3 text-sm font-medium">{flash}</p>}

        {/* Cupo */}
        <div className="mt-10">
          <div className="flex items-baseline justify-between">
            <span className="text-[0.72rem] uppercase tracking-[0.2em] text-[var(--muted)]">Inscritos</span>
            <span className="text-sm tabular-nums">
              {confirmed.length} de {ev.capacity} {pair ? "parejas" : "lugares"}
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full" style={{ background: "var(--line)" }}>
            <div className="h-full" style={{ width: `${Math.min(100, (confirmed.length / ev.capacity) * 100)}%`, background: "var(--brand)" }} />
          </div>
          {confirmed.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2 text-sm">
              {confirmed.map((r) => {
                const p = prof.get(r.user_id);
                return (
                  <li key={r.id} className="border px-2.5 py-1" style={{ borderColor: "var(--line)" }}>
                    {nameOf(r.user_id)}
                    {r.partner_name ? ` y ${first(r.partner_name)}` : ""}
                    {p?.level != null ? (
                      <span className="text-[var(--muted)]"> · {formatLevel(p.level)}</span>
                    ) : p?.division ? (
                      <span className="text-[var(--muted)]"> · {p.division}</span>
                    ) : null}
                    {me && r.user_id === me.id ? <span className="text-[var(--muted)]"> (tú)</span> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Inscripción */}
        {ev.status === "CANCELLED" ? (
          <p className="mt-8 text-[var(--muted)]">Este evento se canceló. Si pagaste, te devolvimos tu inscripción.</p>
        ) : myReg ? (
          <div className="mt-8">
            <p className="text-lg">Ya estás inscrito. ¡Nos vemos ahí!</p>
            <AddToCalendar
              className="mt-2 text-[var(--muted)]"
              event={{ uid: `${ev.id}@sacrepadel.com`, title: `${ev.title} — Sacré Pádel`, start: ev.starts_at, end: ev.ends_at, details: url }}
            />
            {withinCancelWindow(ev.starts_at, now) ? (
              <CancelRegistrationButton eventId={ev.id} />
            ) : (
              <p className="mt-2 text-sm text-[var(--muted)]">
                Faltan menos de {CANCEL_NOTICE_HOURS} h: para cancelar, escríbenos por WhatsApp.
              </p>
            )}
          </div>
        ) : started || ev.status !== "OPEN" ? (
          ev.status !== "FINISHED" && !ev.rounds && <p className="mt-8 text-[var(--muted)]">Las inscripciones están cerradas.</p>
        ) : full ? (
          <div className="mt-8">
            <p className="text-[var(--muted)]">Ya se llenó el cupo.</p>
            {me ? (
              <NotifyMeButton body={{ kind: "EVENT", event_id: ev.id }} />
            ) : (
              <p className="mt-2 text-sm text-[var(--muted)]">
                <Link href={`/login?next=${encodeURIComponent(`/torneos/${ev.id}`)}`} className="underline underline-offset-4">
                  Inicia sesión
                </Link>{" "}
                y te avisamos si se abre un lugar.
              </p>
            )}
          </div>
        ) : !me ? (
          <div className="mt-8">
            <Link href={`/login?next=${encodeURIComponent(`/torneos/${ev.id}`)}`} className="btn-primary w-full !py-3.5 text-center">
              Inicia sesión para inscribirte
            </Link>
          </div>
        ) : (
          (() => {
            const block = joinBlock(
              { match_gender: ev.gender, match_level_min: ev.level_min, match_level_max: ev.level_max },
              me
            );
            return block ? (
              <p className="mt-8 border-l-2 border-amber-600 pl-3 text-sm">
                {block.replace("partido", "evento")}{" "}
                {block.includes("perfil") && (
                  <Link href="/perfil#nivel" className="font-semibold underline underline-offset-4">Ir a mi perfil</Link>
                )}
              </p>
            ) : (
              <RegisterButton eventId={ev.id} price={ev.price} pair={pair} />
            );
          })()
        )}

        {!started && ev.status === "OPEN" && (
          <div className="mt-10 border-t pt-6" style={{ borderColor: "var(--line)" }}>
            <p className="text-sm text-[var(--muted)]">Invita a tus amigos:</p>
            <div className="mt-3">
              <ShareSplitLink url={url} message={`${ev.title} en Sacré Pádel (${s.dateLocal} ${s.timeLocal}). Inscríbete aquí:`} compact />
            </div>
          </div>
        )}

        {/* Americana: tabla y rondas */}
        {ev.rounds && (
          <div className="mt-12 grid gap-10 md:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="text-[0.72rem] uppercase tracking-[0.2em] text-[var(--muted)]">Tabla</p>
              <ol className="mt-3 divide-y border-y text-sm" style={{ borderColor: "var(--line)" }}>
                {standings.map((st, i) => (
                  <li key={st.id} className="flex items-baseline justify-between gap-3 py-2" style={{ borderColor: "var(--line)" }}>
                    <span>
                      <span className="inline-block w-6 tabular-nums text-[var(--muted)]">{i + 1}</span>
                      <span className={i < 3 ? "font-semibold" : ""}>{nameOf(st.id)}</span>
                      {me && st.id === me.id ? <span className="text-[var(--muted)]"> (tú)</span> : null}
                    </span>
                    <span className="tabular-nums">
                      <b>{st.points}</b> <span className="text-xs text-[var(--muted)]">pts · {st.won}G</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="space-y-5">
              <p className="text-[0.72rem] uppercase tracking-[0.2em] text-[var(--muted)]">Rondas</p>
              {ev.rounds.map((r) => (
                <div key={r.round}>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em]">
                    Ronda {r.round}
                    {r.resting.length > 0 && (
                      <span className="font-normal normal-case tracking-normal text-[var(--muted)]"> · descansa {r.resting.map(nameOf).join(", ")}</span>
                    )}
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {r.matches.map((m) => (
                      <li key={m.court} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                        <span className="text-right">{m.teamA.map(nameOf).join(" y ")}</span>
                        <span className="tabular-nums font-semibold">
                          {m.scoreA ?? "–"} : {m.scoreB ?? "–"}
                        </span>
                        <span>{m.teamB.map(nameOf).join(" y ")}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
