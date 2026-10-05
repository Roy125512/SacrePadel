import { NextResponse } from "next/server";
import { sendTomorrowReminders } from "@/lib/bookingReminders";
import { dbErrorResponse } from "@/lib/apiError";

// Lo llama Vercel Cron una vez al día (vercel.json): 00:00 UTC = 6 p.m. en
// Pátzcuaro. Vercel manda "Authorization: Bearer <CRON_SECRET>" cuando la
// variable CRON_SECRET existe en el proyecto; sin ella la ruta no hace nada,
// para que nadie de fuera pueda disparar correos.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET no está configurado; no se mandan recordatorios.");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await sendTomorrowReminders();
    console.log("reminders", summary);
    return NextResponse.json(summary, { status: 200 });
  } catch (e) {
    return dbErrorResponse("GET /api/cron/reminders", e);
  }
}
