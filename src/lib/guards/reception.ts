// src/lib/guards/reception.ts
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";

type GateOk = { ok: true; userId: string; role: string };
type GateNo = { ok: false; res: NextResponse };

export async function requireReceptionAccess(opts?: {
  nextPath?: string; // a dónde regresar luego del login
  asJson?: boolean;  // si es API endpoint, NO redirijas, responde JSON
}): Promise<GateOk | GateNo> {
  const asJson = Boolean(opts?.asJson);
  const nextPath = opts?.nextPath ?? "/reception";

  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();
  const user = data?.user;

  if (error || !user) {
    if (asJson) {
      return {
        ok: false,
        res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }
    redirect(`/login?mode=login&next=${encodeURIComponent(nextPath)}`);
  }

  const userId = user!.id;

  const prof = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  const role = (prof.data?.role ?? "customer") as string;

  if (role !== "owner" && role !== "reception") {
    if (asJson) {
      return {
        ok: false,
        res: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }
    redirect(`/login?mode=login&next=${encodeURIComponent(nextPath)}`);
  }

  return { ok: true, userId, role };
}
