import type { Metadata } from "next";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { customerCancelBlock } from "@/lib/cancellation";
import { mxParts } from "@/lib/bookingNotifications";
import { CANCEL_NOTICE_HOURS } from "@/lib/config";
import { SITE } from "@/lib/site";
import CancelBookingButton from "@/components/booking/CancelBookingButton";

export const metadata: Metadata = { title: "Cancelar reserva", robots: { index: false } };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Página a la que lleva la liga "Cancelar mi reserva" del correo de
 * confirmación. Funciona sin cuenta: el token de la liga identifica la
 * reserva.
 */
export default async function CancelarReservaPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const token = (t ?? "").trim();

  const { data: b } = UUID.test(token)
    ? await supabaseAdmin
        .from("bookings")
        .select("start_at, end_at, status, payment_status, payment_method, paid_amount, refunded_amount, split_parts, split_token, courts ( name )")
        .eq("cancel_token", token)
        .maybeSingle()
    : { data: null };

  const whatsapp = `https://wa.me/${SITE.whatsapp}`;

  return (
    <div className="page">
      <div className="mx-auto max-w-xl px-6 pb-24 pt-28 sm:pt-32">
        <p className="text-[0.72rem] uppercase tracking-[0.3em] text-[var(--brand)]">Tu reserva</p>

        {!b ? (
          <>
            <h1 className="font-display mt-5 text-4xl leading-[1.05]">No encontramos esta reserva.</h1>
            <p className="mt-5 leading-relaxed text-[var(--muted)]">
              La liga puede estar incompleta. Revisa el correo de confirmación o escríbenos por{" "}
              <a href={whatsapp} className="underline underline-offset-4">WhatsApp</a>.
            </p>
          </>
        ) : (
          (() => {
            const s = mxParts(b.start_at);
            const e = mxParts(b.end_at);
            const court = (b.courts as { name: string } | null)?.name ?? "Cancha";
            const block = customerCancelBlock(b);
            const paidOnline =
              (b.payment_status === "PAID" || b.payment_status === "PARTIAL") && b.payment_method === "MERCADOPAGO";
            const split = b.split_parts && b.split_token ? { parts: b.split_parts, url: `/reserva/pagar?t=${b.split_token}` } : null;
            return (
              <>
                <h1 className="font-display mt-5 text-4xl leading-[1.05] sm:text-5xl">
                  {b.status === "CANCELLED" ? "Reserva cancelada." : "¿Cancelar tu reserva?"}
                </h1>

                <dl className="mt-8 divide-y border-y" style={{ borderColor: "var(--line)" }}>
                  {[
                    ["Cancha", court],
                    ["Fecha", s.dateLocal],
                    ["Horario", `${s.timeLocal} – ${e.timeLocal}`],
                    [
                      "Pago",
                      b.payment_status === "REFUNDED"
                        ? `Reembolsado ($${b.refunded_amount ?? b.paid_amount} MXN)`
                        : split
                          ? `Dividido entre ${split.parts} ($${b.paid_amount ?? 0} pagados)`
                          : paidOnline
                          ? `Pagado en línea ($${b.paid_amount} MXN)`
                          : b.payment_status === "PAID"
                            ? "Pagado en recepción"
                            : "En recepción",
                    ],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-6 py-3.5" style={{ borderColor: "var(--line)" }}>
                      <dt className="text-[0.72rem] uppercase tracking-[0.2em] text-[var(--muted)]">{k}</dt>
                      <dd className="text-right">{v}</dd>
                    </div>
                  ))}
                </dl>

                {split && b.status !== "CANCELLED" && b.payment_status === "PARTIAL" && (
                  <p className="mt-6 text-sm">
                    <Link href={split.url} className="font-semibold underline underline-offset-4">
                      Ver quién ya pagó y compartir la liga de pago
                    </Link>
                  </p>
                )}

                {b.status === "CANCELLED" ? (
                  <p className="mt-8 leading-relaxed text-[var(--muted)]">
                    Esta reserva ya está cancelada.{" "}
                    <Link href="/reservar" className="underline underline-offset-4">Reserva otro horario</Link>.
                  </p>
                ) : block === null ? (
                  <>
                    <p className="mt-8 leading-relaxed text-[var(--muted)]">
                      {split && paidOnline
                        ? `Al cancelar, a cada quien le devolvemos lo que pagó ($${b.paid_amount} MXN en total).`
                        : paidOnline
                        ? `Te devolvemos los $${b.paid_amount} MXN a tu método de pago en cuanto canceles.`
                        : "Al cancelar, el horario queda libre para otras personas."}{" "}
                      Puedes cancelar sin costo hasta {CANCEL_NOTICE_HOURS} h antes.
                    </p>
                    <div className="mt-8">
                      <CancelBookingButton token={token} paidOnline={paidOnline} />
                    </div>
                  </>
                ) : (
                  <p className="mt-8 leading-relaxed text-[var(--muted)]">
                    {block === "too_late"
                      ? `Faltan menos de ${CANCEL_NOTICE_HOURS} horas, así que ya no se puede cancelar en línea.`
                      : block === "paid_at_club"
                        ? "Esta reserva se pagó en recepción."
                        : "Esta reserva ya no se puede cancelar."}{" "}
                    Si tienes un imprevisto, escríbenos por{" "}
                    <a href={whatsapp} className="font-semibold underline underline-offset-4">WhatsApp</a> y lo revisamos.
                  </p>
                )}
              </>
            );
          })()
        )}
      </div>
    </div>
  );
}
