import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { DEMO } from "@/lib/demo/flag";
import { makeAdminClient } from "@/lib/demo/serverClient";

// Cliente con la llave de administrador (solo servidor). Tipado con el
// esquema real de la base de datos (src/lib/database.types.ts). El cliente
// falso del modo demo no está tipado: se presenta con la misma interfaz.
export const supabaseAdmin: SupabaseClient<Database> = DEMO
  ? (makeAdminClient() as unknown as SupabaseClient<Database>)
  : createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
