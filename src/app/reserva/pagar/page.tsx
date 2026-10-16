import type { Metadata } from "next";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@/lib/supabaseServer";
import { mpPayment } from "@/lib/mercadopago";
import { mxParts } from "@/lib/bookingNotifications";
import { finalizeSharesPayment, getShares, parseSharesRef, releaseShares, splitUrl } from "@/lib/splitPayments";
import { joinBlock } from "@/lib/openMatches";
import {
  CANCEL_NOTICE_HOURS,
  MATCH_GENDER_LABEL,
  MATCH_TYPE_LABEL,
  SPLIT_DEBT_GRACE_HOURS,
  formatMXN,
  levelRangeLabel,
  withinCancelWindow,
  type MatchGender,
  type MatchType,
} from "@/lib/config";
import { computeExpectedAmountMXN } from "@/lib/pricing-shared";
import { DEMO } from "@/lib/demo/flag";
import { SITE } from "@/lib/site";
import SplitPayForm from "./SplitPayForm";
import { JoinMatchButton, LeaveMatchButton } from "./MatchActions";
import MatchResultPanel from "./MatchResultPanel";
import { matchContext, submitBlock } from "@/lib/levels";
import { formatLevel } from "@/lib/levels-shared";
import ShareSplitLink from "@/components/booking/ShareSplitLink";
import AddToCalendar from "@/components/booking/AddToCalendar";
import { NotifyMeButton } from "@/components/booking/NotifyMe";
import { loadPricing } from "@/lib/pricingSettings";

export const metadata: Metadata = { title: "Pagar mi parte", robots: { index: false } };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Fuera del componente: la página es dinámica (se calcula en cada visita).
const nowMs = () => Date.now();
const firstName = (s: string | null | undefined) => (s ?? "").trim().split(/\s+/)[0] || null;

type Search = {
  t?: string;
  status?: string;
  collection_status?: string;
  payment_id?: string;
  collection_id?: string;
  external_reference?: string;
};

/**
 * Liga del pago dividido: cualquiera de los jugadores paga su parte aquí, sin
 * cuenta. Si la reserva es un partido abierto, es la página del partido: los
 * jugadores con cuenta se unen (o se salen) aquí. También recibe el regreso
 * de Mercado Pago (registra el pago aunque el webhook todavía no llegue).
 */
export default async function PagarPartePage({ searchParams }: { searchParams: Promise<Search> }) {
  await loadPricing();
  const sp = await searchParams;
  const token = (sp.t ?? "").trim();
  const valid = UUID.test(token);

  const { data: b } = valid
    ? await supabaseAdmin
        .from("bookings")
        .select(
          "id, status, start_at, end_at, payment_status, split_parts, user_id, is_open_match, match_type, match_gender, match_level_min, match_level_max, courts ( name ), customers:customer_id ( full_name )"
        )
        .eq("split_token", token)
        .maybeSingle()
    : { data: null };

  // Regreso de Mercado Pago.
  let flash: { tone: "ok" | "warn"; text: string } | null = null;
  const mpStatus = sp.status ?? sp.collection_status;
  const ref = parseSharesRef(sp.external_reference);
  if (b && mpStatus && ref?.bookingId === b.id) {
    const paymentId = sp.payment_id ?? sp.collection_id;
    if (mpStatus === "approved" && paymentId && paymentId !== "null" && !DEMO) {
      try {
        const payment = await mpPayment.get({ id: paymentId });
        if (payment.external_reference === sp.external_reference) await finalizeSharesPayment(payment);
        flash = { tone: "ok", text: b.is_open_match ? "¡Listo, ya estás en el partido!" : "¡Gracias! Tu pago quedó registrado." };
      } catch (e) {
        console.error("pagar: finalize on return", e);
        flash = { tone: "ok", text: "Tu pago fue aprobado; en unos momentos se verá aquí." };
      }
    } else if (mpStatus === "pending" || mpStatus === "in_process") {
      flash = { tone: "warn", text: "Tu pago está en revisión. Se verá aquí en cuanto se acredite." };
    } else if (mpStatus !== "approved") {
      await releaseShares(ref.shareIds);
      flash = { tone: "warn", text: "El pago no se completó. Puedes intentar de nuevo." };
    }
  }

  const shares = b ? await getShares(b.id).catch(() => []) : [];
  const paid = shares.filter((s) => s.status === "PAID");
  const pending = shares.filter((s) => s.status === "PENDING");
  const whatsapp = `https://wa.me/${SITE.whatsapp}`;

  // Partido abierto: quién soy y quiénes juegan (nombre y división).
  let me: { id: string; sex: string | null; division: string | null; level: number | null } | null = null;
  const players = new Map<string, { full_name: string | null; division: string | null; level: number | null }>();
  if (b?.is_open_match) {
    try {
      const supabase = await createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (auth?.user) {
        const { data: p } = await supabaseAdmin.from("profiles").select("sex, division, level").eq("id", auth.user.id).maybeSingle();
        me = { id: auth.user.id, sex: p?.sex ?? null, division: p?.division ?? null, level: p?.level ?? null };
      }
    } catch {}
    const ids = shares.map((s) => s.user_id).filter((x): x is string => !!x);
    if (ids.length) {
      const { data: profs } = await supabaseAdmin.from("profiles").select("id, full_name, division, level").in("id", ids);
      for (const p of profs ?? []) players.set(p.id, p);
    }
  }

  // Partido competitivo: resultado y nivel.
  const ctx = b?.is_open_match && b.match_type === "COMPETITIVE" ? await matchContext(b.id) : null;

  return (
    <div className="page">
      <div className="mx-auto max-w-xl px-6 pb-24 pt-28 sm:pt-32">
        <p className="text-[0.72rem] uppercase tracking-[0.3em] text-[var(--brand)]">
          {b?.is_open_match ? "Partido abierto" : "Pago dividido"}
        </p>

        {!b || !b.split_parts ? (
          <>
            <h1 className="font-display mt-5 text-4xl leading-[1.05]">No encontramos esta reserva.</h1>
            <p className="mt-5 leading-relaxed text-[var(--muted)]">
              La liga puede estar incompleta. Pídele a quien reservó que te la mande de nuevo, o escríbenos por{" "}
              <a href={whatsapp} className="underline underline-offset-4">WhatsApp</a>.
            </p>
          </>
        ) : (
          (() => {
            const s = mxParts(b.start_at);
            const e = mxParts(b.end_at);
            const court = (b.courts as { name: string } | null)?.name ?? "Cancha";
            const organizer = firstName((b.customers as { full_name: string | null } | null)?.full_name);
            const total = computeExpectedAmountMXN(b.start_at, b.end_at);
            const now = nowMs();
            const ended = new Date(b.end_at).getTime() < now;
            const debtAt = new Date(b.end_at).getTime() + SPLIT_DEBT_GRACE_HOURS * 3600_000;
            const cancelled = b.status === "CANCELLED";
            const allPaid = pending.length === 0 && !cancelled;
            const open = b.is_open_match;
            const iAmOrganizer = !!me && me.id === b.user_id;
            const iAmIn = !!me && paid.some((p) => p.user_id === me!.id);
            const share = pending[0]?.amount ?? shares[shares.length - 1]?.amount ?? 0;

            const title = cancelled
              ? open ? "Partido cancelado." : "Reserva cancelada."
              : allPaid
                ? open ? "Partido completo." : "Todo pagado."
                : open ? "Únete al partido." : "Paga tu parte.";

            return (
              <>
                <h1 className="font-display mt-5 text-4xl leading-[1.05] sm:text-5xl">{title}</h1>
                <p className="mt-4 leading-relaxed text-[var(--muted)]">
                  {open
                    ? `${organizer ?? "Alguien"} armó un partido en ${court}${
                        pending.length > 0 && !cancelled
                          ? `: ${pending.length === 1 ? "falta 1 jugador" : `faltan ${pending.length} jugadores`}.`
                          : "."
                      }`
                    : `${organizer ? `${organizer} reservó` : "Se reservó"} ${court} y dividió el pago entre ${b.split_parts}.`}
                </p>

                {open && (
                  <ul className="mt-5 flex flex-wrap gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.16em]">
                    {[
                      MATCH_TYPE_LABEL[(b.match_type ?? "FRIENDLY") as MatchType],
                      MATCH_GENDER_LABEL[(b.match_gender ?? "ANY") as MatchGender],
                      levelRangeLabel(b.match_level_min, b.match_level_max),
                    ].map((t) => (
                      <li key={t} className="border px-2.5 py-1" style={{ borderColor: "var(--line)" }}>
                        {t}
                      </li>
                    ))}
                  </ul>
                )}

                {flash && (
                  <p
                    role="status"
                    className={`mt-6 border-l-2 pl-3 text-sm font-medium ${flash.tone === "ok" ? "border-[var(--brand)]" : "border-amber-600"}`}
                  >
                    {flash.text}
                  </p>
                )}

                <dl className="mt-8 divide-y border-y" style={{ borderColor: "var(--line)" }}>
                  {[
                    ["Fecha", s.dateLocal],
                    ["Horario", `${s.timeLocal} – ${e.timeLocal}`],
                    open ? ["Por jugador", `${formatMXN(share)} MXN`] : ["Total cancha", `${formatMXN(total)} MXN`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-6 py-3.5" style={{ borderColor: "var(--line)" }}>
                      <dt className="text-[0.72rem] uppercase tracking-[0.2em] text-[var(--muted)]">{k}</dt>
                      <dd className="text-right tabular-nums">{v}</dd>
                    </div>
                  ))}
                </dl>

                {/* Avance: una barra por parte */}
                <div className="mt-8">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[0.72rem] uppercase tracking-[0.2em] text-[var(--muted)]">
                      {open ? "Jugadores" : "Partes"}
                    </span>
                    <span className="text-sm tabular-nums">
                      {paid.length} de {shares.length} {open ? "lugares" : "pagadas"}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-1.5" aria-hidden>
                    {shares.map((sh) => (
                      <span
                        key={sh.id}
                        className="h-1.5 flex-1"
                        style={{ background: sh.status === "PAID" ? "var(--brand)" : "var(--line)" }}
                      />
                    ))}
                  </div>
                  <ul className="mt-4 space-y-2 text-sm">
                    {shares.map((sh) => {
                      const p = sh.user_id ? players.get(sh.user_id) : undefined;
                      const name = firstName(p?.full_name ?? sh.payer_name) ?? (sh.seq === 1 ? organizer : null);
                      return (
                        <li key={sh.id} className="flex justify-between gap-4">
                          <span>
                            {open ? (sh.status === "PAID" ? name ?? "Jugador" : "Lugar libre") : `Jugador ${sh.seq}`}
                            {!open && sh.status === "PAID" && name ? ` · ${name}` : ""}
                            {open && sh.status === "PAID" && (p?.level != null || p?.division) ? (
                              <span className="text-[var(--muted)]">
                                {" "}
                                · {p.level != null ? `nivel ${formatLevel(p.level)}` : p.division}
                              </span>
                            ) : null}
                            {open && me && sh.user_id === me.id ? <span className="text-[var(--muted)]"> (tú)</span> : null}
                          </span>
                          <span className="tabular-nums text-[var(--muted)]">
                            {sh.status === "PAID"
                              ? open ? "Confirmado" : `Pagó ${formatMXN(sh.amount)}`
                              : sh.status === "REFUNDED"
                                ? "Reembolsado"
                                : sh.status === "CANCELLED"
                                  ? "—"
                                  : open ? formatMXN(sh.amount) : `Pendiente ${formatMXN(sh.amount)}`}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {cancelled ? (
                  <p className="mt-8 leading-relaxed text-[var(--muted)]">
                    Si pagaste tu parte, te la devolvimos a tu método de pago.{" "}
                    <Link href={open ? "/partidos" : "/reservar"} className="underline underline-offset-4">
                      {open ? "Ver otros partidos" : "Reserva otro horario"}
                    </Link>
                    .
                  </p>
                ) : open ? (
                  /* ===== Partido abierto ===== */
                  <>
                    {ended && (iAmOrganizer || iAmIn) ? (
                      <p className="mt-8 leading-relaxed text-[var(--muted)]">
                        {ctx ? "Jugaste este partido." : "Jugaste este partido. ¡Gracias por venir!"}
                      </p>
                    ) : iAmOrganizer ? (
                      <p className="mt-8 leading-relaxed text-[var(--muted)]">
                        Creaste este partido.{" "}
                        {pending.length > 0
                          ? `Si no se llena, lo que falte queda a tu cargo; puedes cancelarlo sin costo hasta ${CANCEL_NOTICE_HOURS} h antes desde Mis reservas.`
                          : "¡Ya está completo!"}
                      </p>
                    ) : iAmIn ? (
                      <>
                        <p className="mt-8 leading-relaxed">Ya estás en este partido. ¡Nos vemos en la cancha!</p>
                        <AddToCalendar
                          className="mt-2 text-[var(--muted)]"
                          event={{
                            uid: `${b.id}@sacrepadel.com`,
                            title: `Partido · ${court} — Sacré Pádel`,
                            start: b.start_at,
                            end: b.end_at,
                            details: splitUrl(token),
                          }}
                        />
                        {withinCancelWindow(b.start_at, now) ? (
                          <LeaveMatchButton token={token} />
                        ) : (
                          <p className="mt-2 text-sm text-[var(--muted)]">
                            Faltan menos de {CANCEL_NOTICE_HOURS} h: para salirte, escríbenos por{" "}
                            <a href={whatsapp} className="underline underline-offset-4">WhatsApp</a>.
                          </p>
                        )}
                      </>
                    ) : allPaid || ended ? (
                      <>
                        <p className="mt-8 leading-relaxed text-[var(--muted)]">
                          {ended ? "Este partido ya se jugó." : "Este partido ya está completo."}{" "}
                          <Link href="/partidos" className="underline underline-offset-4">Ver otros partidos</Link>.
                        </p>
                        {!ended && me && <NotifyMeButton body={{ kind: "MATCH", token }} />}
                      </>
                    ) : !me ? (
                      <div className="mt-8">
                        <Link
                          href={`/login?next=${encodeURIComponent(`/reserva/pagar?t=${token}`)}`}
                          className="btn-primary w-full !py-3.5 text-center"
                        >
                          Inicia sesión para unirte
                        </Link>
                        <p className="mt-3 text-xs text-[var(--muted)]">
                          Necesitas cuenta para que el grupo sepa quién juega y con qué nivel.
                        </p>
                      </div>
                    ) : (
                      (() => {
                        const block = joinBlock(b, me);
                        return block ? (
                          <p className="mt-8 border-l-2 border-amber-600 pl-3 text-sm leading-relaxed">
                            {block}{" "}
                            {block.includes("perfil") && (
                              <Link href="/perfil" className="font-semibold underline underline-offset-4">Ir a mi perfil</Link>
                            )}
                          </p>
                        ) : (
                          <JoinMatchButton token={token} amount={share} />
                        );
                      })()
                    )}
                    {ctx && ended && (
                      <MatchResultPanel
                        token={token}
                        meId={me?.id ?? null}
                        players={ctx.players.map((id) => ({
                          id,
                          name: firstName(players.get(id)?.full_name) ?? "Jugador",
                          level: players.get(id)?.level ?? null,
                        }))}
                        result={ctx.result}
                        submitBlock={me ? submitBlock(ctx, me.id) : "Inicia sesión para ver o capturar el resultado."}
                      />
                    )}
                    {!allPaid && !ended && (
                      <div className="mt-10 border-t pt-6" style={{ borderColor: "var(--line)" }}>
                        <p className="text-sm text-[var(--muted)]">¿Conoces a alguien que quiera jugar? Mándale el partido:</p>
                        <div className="mt-3">
                          <ShareSplitLink
                            url={splitUrl(token)}
                            message={`¿Te late un partido de pádel ${s.dateLocal} a las ${s.timeLocal} en Sacré Pádel? Faltan ${pending.length}:`}
                            compact
                          />
                        </div>
                      </div>
                    )}
                  </>
                ) : allPaid ? (
                  <p className="mt-8 leading-relaxed text-[var(--muted)]">
                    Ya pagaron todos. ¡Nos vemos en la cancha! Llega con 15 minutos de tolerancia.
                  </p>
                ) : (
                  <>
                    {ended && (
                      <p className="mt-8 border-l-2 border-amber-600 pl-3 text-sm leading-relaxed">
                        El partido ya terminó.{" "}
                        {now >= debtAt
                          ? `Lo que falta quedó a cargo de ${organizer ?? "quien reservó"}, y no podrá volver a reservar hasta cubrirlo.`
                          : `Si no se paga antes de ${SPLIT_DEBT_GRACE_HOURS} h después del partido, queda a cargo de ${organizer ?? "quien reservó"}.`}
                      </p>
                    )}
                    <SplitPayForm token={token} shareAmounts={pending.map((p) => p.amount)} />
                    <div className="mt-10 border-t pt-6" style={{ borderColor: "var(--line)" }}>
                      <p className="text-sm text-[var(--muted)]">¿Falta alguien? Mándale la liga:</p>
                      <div className="mt-3">
                        <ShareSplitLink
                          url={splitUrl(token)}
                          message={`Paga tu parte de la cancha (${s.dateLocal} ${s.timeLocal}) en Sacré Pádel:`}
                          compact
                        />
                      </div>
                    </div>
                  </>
                )}
              </>
            );
          })()
        )}
      </div>
    </div>
  );
}
