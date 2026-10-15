import type { Metadata } from "next";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mpPayment } from "@/lib/mercadopago";
import { mxParts } from "@/lib/bookingNotifications";
import { finalizeSharesPayment, getShares, parseSharesRef, releaseShares, splitUrl } from "@/lib/splitPayments";
import { SPLIT_DEBT_GRACE_HOURS, formatMXN } from "@/lib/config";
import { computeExpectedAmountMXN } from "@/lib/pricing-shared";
import { DEMO } from "@/lib/demo/flag";
import { SITE } from "@/lib/site";
import SplitPayForm from "./SplitPayForm";
import ShareSplitLink from "@/components/booking/ShareSplitLink";

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
 * cuenta. También recibe el regreso de Mercado Pago (registra el pago aunque
 * el webhook todavía no llegue).
 */
export default async function PagarPartePage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const token = (sp.t ?? "").trim();
  const valid = UUID.test(token);

  const { data: b } = valid
    ? await supabaseAdmin
        .from("bookings")
        .select("id, status, start_at, end_at, payment_status, split_parts, courts ( name ), customers:customer_id ( full_name )")
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
        flash = { tone: "ok", text: "¡Gracias! Tu pago quedó registrado." };
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

  return (
    <div className="page">
      <div className="mx-auto max-w-xl px-6 pb-24 pt-28 sm:pt-32">
        <p className="text-[0.72rem] uppercase tracking-[0.3em] text-[var(--brand)]">Pago dividido</p>

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
            return (
              <>
                <h1 className="font-display mt-5 text-4xl leading-[1.05] sm:text-5xl">
                  {cancelled ? "Reserva cancelada." : allPaid ? "Todo pagado." : "Paga tu parte."}
                </h1>
                <p className="mt-4 leading-relaxed text-[var(--muted)]">
                  {organizer ? `${organizer} reservó` : "Se reservó"} {court} y dividió el pago entre {b.split_parts}.
                </p>

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
                    ["Total cancha", `${formatMXN(total)} MXN`],
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
                    <span className="text-[0.72rem] uppercase tracking-[0.2em] text-[var(--muted)]">Partes</span>
                    <span className="text-sm tabular-nums">
                      {paid.length} de {shares.length} pagadas
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
                    {shares.map((sh) => (
                      <li key={sh.id} className="flex justify-between gap-4">
                        <span>
                          Jugador {sh.seq}
                          {sh.status === "PAID" && firstName(sh.payer_name) ? ` · ${firstName(sh.payer_name)}` : ""}
                          {sh.seq === 1 && organizer && !sh.payer_name ? ` · ${organizer}` : ""}
                        </span>
                        <span className="tabular-nums text-[var(--muted)]">
                          {sh.status === "PAID"
                            ? `Pagó ${formatMXN(sh.amount)}`
                            : sh.status === "REFUNDED"
                              ? "Reembolsado"
                              : sh.status === "CANCELLED"
                                ? "—"
                                : `Pendiente ${formatMXN(sh.amount)}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {cancelled ? (
                  <p className="mt-8 leading-relaxed text-[var(--muted)]">
                    Si pagaste tu parte, te la devolvimos a tu método de pago.{" "}
                    <Link href="/reservar" className="underline underline-offset-4">Reserva otro horario</Link>.
                  </p>
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
