import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { playerStats } from "@/lib/playerStats";
import { dbErrorResponse } from "@/lib/apiError";

// Estadísticas del jugador para su perfil.
export async function GET() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data?.user) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
    return NextResponse.json(await playerStats(data.user.id));
  } catch (e) {
    return dbErrorResponse("GET /api/web/stats", e);
  }
}
