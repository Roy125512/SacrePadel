import { NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cleanupExpiredWebHolds } from "@/lib/holdCleanup";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { dbErrorResponse } from "@/lib/apiError";
import { MAX_BOOKING_MINUTES } from "@/lib/config";

export async function POST(req: Request) {
  try {
    const rl = await rateLimit(`hold:${clientIp(req)}`, 20, 60_000);
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

    // Solo lo indispensable antes de apartar: HOLDs vencidos que chocan con
    // este horario (la base de datos los sigue contando para el traslape).
    await cleanupExpiredWebHolds({ courtId: court_id, startIso: start_at, endIso: end_at });

    // El resto de la limpieza (incluidas consultas a Mercado Pago) corre
    // después de responder, para que el cliente no la espere.
    after(() =>
      cleanupExpiredWebHolds().catch((e) => console.error("POST /api/web/hold background cleanup", e))
    );

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
