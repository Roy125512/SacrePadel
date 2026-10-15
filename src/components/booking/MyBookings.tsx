"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CANCEL_NOTICE_HOURS, formatMXN } from "@/lib/config";
import { SITE } from "@/lib/site";
import CancelBookingButton from "@/components/booking/CancelBookingButton";
import ShareSplitLink from "@/components/booking/ShareSplitLink";

type MyBooking = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  paid_amount: number | null;
  refunded_amount: number | null;
  court_name: string;
  upcoming: boolean;
  can_cancel: boolean;
  cancel_block: string | null;
  split: { parts: number; url: string; remaining: number; overdue: boolean } | null;
};

const TZ = "America/Mexico_City";
const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-MX", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });

function statusLabel(b: MyBooking) {
  if (b.status === "CANCELLED") return b.payment_status === "REFUNDED" ? `Cancelada · reembolsados $${b.refunded_amount}` : "Cancelada";
  if (b.status === "COMPLETED") return "Jugada";
  if (b.status === "NO_SHOW") return "No asististe";
  if (b.split && b.payment_status === "PARTIAL") return `Pago dividido · faltan ${formatMXN(b.split.remaining)}`;
  if (b.split && b.payment_status === "PAID") return "Pago dividido · todo pagado";
  if (b.payment_status === "PAID") return b.payment_method === "MERCADOPAGO" ? `Pagada en línea · $${b.paid_amount}` : "Pagada";
  return "Pago en recepción";
}

/** "Mis reservas" del perfil: próximas (con cancelar) y recientes. */
export default function MyBookings() {
  const [items, setItems] = useState<MyBooking[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/web/my-bookings", { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      setItems(j.bookings ?? []);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const upcoming = (items ?? []).filter((b) => b.upcoming && b.status === "CONFIRMED").reverse();
  const past = (items ?? []).filter((b) => !(b.upcoming && b.status === "CONFIRMED")).slice(0, 8);
  const debts = (items ?? []).filter((b) => b.split?.overdue);

  return (
    <section id="mis-reservas" className="mt-12 scroll-mt-24">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">Mis reservas</p>
      {notice && (
        <p role="status" className="mt-4 border-l-2 border-[var(--brand)] pl-3 text-sm">
          {notice}
        </p>
      )}

      {debts.map((b) => (
        <div key={b.id} role="alert" className="mt-4 border-l-2 border-amber-600 bg-amber-50/60 px-4 py-3 text-sm">
          <p>
            Tienes <b>{formatMXN(b.split!.remaining)} MXN</b> pendientes del partido del {fmtDay(b.start_at)}: las partes
            que no se pagaron quedaron a tu cargo. Cúbrelas para volver a reservar.
          </p>
          <a href={b.split!.url} className="mt-2 inline-block font-semibold underline underline-offset-4">
            Pagar lo pendiente
          </a>
        </div>
      ))}

      {failed ? (
        <p className="mt-4 text-sm text-[var(--muted)]">No pudimos cargar tus reservas. Recarga la página.</p>
      ) : items === null ? (
        <p className="mt-4 text-sm text-[var(--muted)]">Cargando…</p>
      ) : (
        <>
          {upcoming.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">
              No tienes reservas próximas.{" "}
              <Link href="/reservar" className="font-semibold text-[var(--foreground)] underline underline-offset-4">
                Reservar cancha
              </Link>
            </p>
          ) : (
            <ul className="mt-4 divide-y border-y" style={{ borderColor: "var(--line)" }}>
              {upcoming.map((b) => (
                <li key={b.id} className="py-5" style={{ borderColor: "var(--line)" }}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                    <div className="font-display text-2xl first-letter:uppercase">{fmtDay(b.start_at)}</div>
                    <div className="tabular-nums">
                      {fmtTime(b.start_at)} – {fmtTime(b.end_at)} · {b.court_name}
                    </div>
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{statusLabel(b)}</div>
                  {b.split && b.payment_status === "PARTIAL" && (
                    <div className="mt-4">
                      <ShareSplitLink
                        url={b.split.url}
                        message={`Paga tu parte de la cancha (${fmtDay(b.start_at)} ${fmtTime(b.start_at)}) en Sacré Pádel:`}
                        compact
                      />
                    </div>
                  )}
                  <div className="mt-4">
                    {b.can_cancel ? (
                      <CancelBookingButton
                        bookingId={b.id}
                        paidOnline={(b.payment_status === "PAID" || b.payment_status === "PARTIAL") && b.payment_method === "MERCADOPAGO"}
                        onDone={(msg) => {
                          setNotice(msg);
                          void load();
                        }}
                        compact
                      />
                    ) : (
                      <p className="text-sm text-[var(--muted)]">
                        {b.cancel_block === "too_late"
                          ? `Ya no se puede cancelar en línea (menos de ${CANCEL_NOTICE_HOURS} h).`
                          : "Para cambios en esta reserva, contacta al club."}{" "}
                        <a href={`https://wa.me/${SITE.whatsapp}`} className="font-semibold text-[var(--foreground)] underline underline-offset-4">
                          WhatsApp
                        </a>
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {past.length > 0 && (
            <>
              <p className="mt-8 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Recientes</p>
              <ul className="mt-3 divide-y text-sm" style={{ borderColor: "var(--line)" }}>
                {past.map((b) => (
                  <li key={b.id} className="flex flex-wrap justify-between gap-x-6 gap-y-1 py-3" style={{ borderColor: "var(--line)" }}>
                    <span className="inline-block first-letter:uppercase">
                      {fmtDay(b.start_at)} · {fmtTime(b.start_at)} · {b.court_name}
                    </span>
                    <span className="text-[var(--muted)]">{statusLabel(b)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <p className="mt-6 text-xs text-[var(--muted)]">
            Puedes cancelar sin costo hasta {CANCEL_NOTICE_HOURS} h antes; si pagaste en línea, te devolvemos el pago
            automáticamente.
          </p>
        </>
      )}
    </section>
  );
}
