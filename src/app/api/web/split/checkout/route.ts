import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mpPreference } from "@/lib/mercadopago";
import { claimSharesForCheckout, releaseShares, sharesRef } from "@/lib/splitPayments";
import { DEMO } from "@/lib/demo/flag";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { dbErrorResponse } from "@/lib/apiError";

// Un compañero paga su parte (o varias) de una reserva dividida, sin cuenta,
// desde la liga /reserva/pagar?t=<split_token>.
const BodySchema = z.object({
  token: z.string().uuid(),
  count: z.number().int().min(1).max(3),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
});

const CHECKOUT_MINUTES = 20;

export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit(`split-checkout:${clientIp(req)}`, 10, 60_000);
    if (!rl.ok) {
      return NextResponse.json({ error: "Demasiadas solicitudes. Espera unos segundos." }, { status: 429 });
    }

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Escribe tu nombre (y un correo válido, si lo pones)." }, { status: 400 });
    }
    if (DEMO) {
      return NextResponse.json({ error: "El pago en línea no está disponible en modo demo." }, { status: 503 });
    }
    const { token, count, name } = parsed.data;
    const email = parsed.data.email || null;

    const { data: booking, error } = await supabaseAdmin
      .from("bookings")
      .select("id, status, payment_status, courts ( name )")
      .eq("split_token", token)
      .maybeSingle();
    if (error) return dbErrorResponse("POST /api/web/split/checkout fetch", error);
    if (!booking) return NextResponse.json({ error: "No encontramos esta reserva." }, { status: 404 });
    if (booking.status === "CANCELLED") {
      return NextResponse.json({ error: "Esta reserva se canceló." }, { status: 409 });
    }
    if (booking.payment_status === "PAID") {
      return NextResponse.json({ error: "Ya se pagaron todas las partes. ¡Nos vemos en la cancha!" }, { status: 409 });
    }
    if (booking.payment_status !== "PARTIAL") {
      return NextResponse.json({ error: "Esta reserva todavía no está confirmada." }, { status: 409 });
    }

    const claim = await claimSharesForCheckout(booking.id, count);
    if (!claim.ok) return NextResponse.json({ error: claim.message }, { status: 409 });

    const origin = new URL(req.url).origin;
    const back = `${origin}/reserva/pagar?t=${token}`;
    const now = new Date();
    const court = (booking.courts as { name: string } | null)?.name ?? "cancha";
    try {
      const pref = await mpPreference.create({
        body: {
          items: [
            {
              id: booking.id,
              title: `${count === 1 ? "Tu parte" : `${count} partes`} · ${court} — Sacré Pádel`,
              quantity: 1,
              currency_id: "MXN",
              unit_price: claim.amount,
            },
          ],
          external_reference: sharesRef(booking.id, claim.shareIds),
          metadata: { payer_name: name, payer_email: email ?? "" },
          ...(email ? { payer: { email } } : {}),
          back_urls: { success: back, pending: back, failure: back },
          notification_url: `${origin}/api/mercadopago/webhook`,
          expires: true,
          expiration_date_from: now.toISOString(),
          expiration_date_to: new Date(now.getTime() + CHECKOUT_MINUTES * 60_000).toISOString(),
          payment_methods: { excluded_payment_types: [{ id: "ticket" }] },
          ...(origin.startsWith("https://") ? { auto_return: "approved" } : {}),
        },
      });
      const init_point = pref.init_point ?? pref.sandbox_init_point;
      if (!init_point) throw new Error("sin init_point");
      return NextResponse.json({ init_point });
    } catch (e) {
      await releaseShares(claim.shareIds);
      console.error("split checkout preference", booking.id, e);
      return NextResponse.json({ error: "Mercado Pago no respondió. Intenta de nuevo." }, { status: 502 });
    }
  } catch (e) {
    return dbErrorResponse("POST /api/web/split/checkout", e);
  }
}
