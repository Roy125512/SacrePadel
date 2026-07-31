import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mpPayment } from "@/lib/mercadopago";
import { DEMO } from "@/lib/demo/flag";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { dbErrorResponse } from "@/lib/apiError";
import { MAX_BOOKING_MINUTES } from "@/lib/config";

export async function POST(req: Request) {
  try {
    const rl = rateLimit(`hold:${clientIp(req)}`, 20, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Espera unos segundos e intenta de nuevo." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const court_id = String(body.court_id ?? "").trim();
    const start_at = String(body.start_at ?? "").trim();
    const end_at = String(body.end_at ?? "").trim();

    if (!court_id || !start_at || !end_at) {
      return NextResponse.json(
        { error: "court_id, start_at, end_at are required" },
        { status: 400 }
      );
    }

    if (new Date(start_at).getTime() < Date.now()) {
      return NextResponse.json(
        { error: "Ese horario ya pasó. Elige uno disponible." },
        { status: 409 }
      );
    }

    // Límite de duración: sin esto, un caller directo a la API (no la UI,
    // que solo ofrece hasta 180 min) podría pedir un end_at arbitrariamente
    // lejano y bloquear la disponibilidad de una cancha para todos mientras
    // el HOLD siga vivo (hasta 10 min).
    const durationMinutes = (new Date(end_at).getTime() - new Date(start_at).getTime()) / 60_000;
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0 || durationMinutes > MAX_BOOKING_MINUTES) {
      return NextResponse.json(
        { error: `La duración debe ser de máximo ${MAX_BOOKING_MINUTES} minutos.` },
        { status: 400 }
      );
    }

    const holdMinutes = 10;
    const hold_expires_at = new Date(Date.now() + holdMinutes * 60_000).toISOString();

    // Limpieza: un solo SELECT de HOLDS expirados, luego se decide por fila
    // si es seguro borrarla (una sola query en vez de dos round-trips).
    const nowIso = new Date().toISOString();
    const { data: expired, error: expiredErr } = await supabaseAdmin
      .from("bookings")
      .select("id, mp_preference_id")
      .eq("status", "HOLD")
      .eq("source", "WEB")
      .lt("hold_expires_at", nowIso);

    if (expiredErr) {
      return dbErrorResponse("POST /api/web/hold fetch expired holds", expiredErr);
    }

    if (expired && expired.length > 0) {
      const noPayment = expired.filter((h: any) => !h.mp_preference_id);
      const withMpPref = expired.filter((h: any) => h.mp_preference_id);

      const deletableIds: string[] = noPayment.map((h: any) => h.id);

      // Safety net for Mercado Pago: a HOLD can expire while the customer
      // is mid-checkout, or right after paying if they close the browser
      // before it returns to /reservar. If the webhook hasn't (yet, or
      // isn't configured) flipped the booking to CONFIRMED/PAID either,
      // this booking would otherwise sit stuck in HOLD forever — worse,
      // once hold_expires_at is in the past the availability grid stops
      // treating it as blocking (see fetchBlockingBookings), so it would
      // *look* free to other customers while still occupying the slot at
      // the DB level. So: never delete a booking that actually got paid,
      // and reconcile it to CONFIRMED/PAID right here if it hasn't been
      // already — this makes every visitor's browsing traffic double as a
      // lazy poll, closing the gap even without the webhook configured.
      if (withMpPref.length > 0 && !DEMO) {
        const results = await Promise.allSettled(
          withMpPref.map(async (h: any) => {
            const search = await mpPayment.search({ options: { external_reference: h.id } });
            const approved = (search.results ?? []).find((p) => p.status === "approved");

            if (approved) {
              await supabaseAdmin
                .from("bookings")
                .update({
                  status: "CONFIRMED",
                  payment_status: "PAID",
                  payment_method: "MERCADOPAGO",
                  paid_amount: approved.transaction_amount ?? null,
                  paid_at: approved.date_approved ?? new Date().toISOString(),
                  mp_payment_id: String(approved.id),
                  hold_expires_at: null,
                })
                .eq("id", h.id)
                .eq("status", "HOLD");

              console.warn(
                "Expired HOLD had an approved Mercado Pago payment — reconciled to CONFIRMED/PAID:",
                h.id
              );
              return null;
            }

            return h.id as string;
          })
        );

        for (const r of results) {
          if (r.status === "fulfilled" && r.value) {
            deletableIds.push(r.value);
          } else if (r.status === "rejected") {
            console.error("hold cleanup: failed to check Mercado Pago payment status", r.reason);
          }
        }
      }

      if (deletableIds.length > 0) {
        await supabaseAdmin.from("bookings").delete().in("id", deletableIds);
      }
    }

    const { data, error } = await supabaseAdmin
      .from("bookings")
      .insert({
        court_id,
        start_at,
        end_at,
        status: "HOLD",
        source: "WEB",
        kind: "STANDARD",
        hold_expires_at,
      })
      .select("id, court_id, start_at, end_at, status, hold_expires_at")
      .single();

    if (error) {
      if (error.message.includes("bookings_no_overlap")) {
        return NextResponse.json(
          { error: "Ese horario ya fue tomado. Da clic en “Ver disponibilidad” y elige otro horario." },
          { status: 409 }
        );
      }
      return dbErrorResponse("POST /api/web/hold insert booking", error, 409);
    }

    return NextResponse.json({ booking: data }, { status: 201 });
  } catch (e: any) {
    return dbErrorResponse("POST /api/web/hold", e);
  }
}
