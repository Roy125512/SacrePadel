import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireReceptionAccess } from "@/lib/guards/reception";
import { BUSINESS_TZ_OFFSET } from "@/lib/config";
import { dbErrorResponse } from "@/lib/apiError";
import { DEFAULT_COURTS, OPEN_HOUR, CLOSE_HOUR, hoursBetween } from "@/lib/reception/utils";

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

// Resumen de ocupación/ingresos por mes de un año completo, para la línea de
// tiempo anual del dashboard. Se consulta mes por mes (en paralelo) en vez
// de traer las reservas del año completo de un jalón — así cada consulta se
// mantiene chica sin depender de cuántas reservas tenga el club en un año.
export async function GET(req: Request) {
  const gate = await requireReceptionAccess({ asJson: true });
  if (!gate.ok) return gate.res;

  // Igual que el filtro por rango en /api/reception/bookings: esta es
  // información agregada del negocio completo, solo para el dueño.
  if (gate.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const yearParam = Number(searchParams.get("year"));
  const year = Number.isFinite(yearParam) && yearParam > 2000 ? yearParam : new Date().getFullYear();

  try {
    const months = await Promise.all(
      Array.from({ length: 12 }, (_, i) => i + 1).map(async (month) => {
        const startIso = `${year}-${String(month).padStart(2, "0")}-01T00:00:00${BUSINESS_TZ_OFFSET}`;
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        const endIso = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00${BUSINESS_TZ_OFFSET}`;

        const { data, error } = await supabaseAdmin
          .from("bookings")
          .select("start_at, end_at, status, payment_status, paid_amount")
          .gte("start_at", startIso)
          .lt("start_at", endIso)
          .neq("status", "CANCELLED");

        if (error) throw error;

        let horasVendidas = 0;
        let ingresos = 0;
        let reservas = 0;

        for (const b of data ?? []) {
          if (b.status === "CONFIRMED" || b.status === "COMPLETED") {
            horasVendidas += hoursBetween(b.start_at, b.end_at);
            reservas += 1;
          }
          if (b.payment_status === "PAID") ingresos += Number(b.paid_amount ?? 0);
        }

        const capacity = DEFAULT_COURTS * (CLOSE_HOUR - OPEN_HOUR) * daysInMonth(year, month);
        const ocupacion = capacity > 0 ? (horasVendidas / capacity) * 100 : 0;

        return {
          month,
          label: MONTH_LABELS[month - 1],
          reservas,
          ingresos,
          horasVendidas: Math.round(horasVendidas * 10) / 10,
          ocupacion: Math.round(ocupacion * 10) / 10,
        };
      })
    );

    return NextResponse.json({ year, months }, { status: 200 });
  } catch (e: any) {
    return dbErrorResponse("GET /api/reception/monthly-summary", e);
  }
}
