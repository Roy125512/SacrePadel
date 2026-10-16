import { NextResponse } from "next/server";
import { availableClassTimes, CLASS_DURATIONS, getCoach } from "@/lib/classes";
import { dbErrorResponse } from "@/lib/apiError";

// Horas disponibles para una clase con este entrenador en un día.
export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const coachId = u.searchParams.get("coach") ?? "";
    const date = u.searchParams.get("date") ?? "";
    const minutes = Number(u.searchParams.get("minutes") ?? 60);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !(CLASS_DURATIONS as readonly number[]).includes(minutes)) {
      return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    }
    const coach = await getCoach(coachId).catch(() => null);
    if (!coach || !coach.active) return NextResponse.json({ error: "No encontramos al entrenador." }, { status: 404 });
    const times = await availableClassTimes(coach, date, minutes);
    return NextResponse.json({ times });
  } catch (e) {
    return dbErrorResponse("GET /api/web/classes/slots", e);
  }
}
