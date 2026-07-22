import { createClient } from "@supabase/supabase-js";
import { DEMO } from "@/lib/demo/flag";
import { makeAdminClient } from "@/lib/demo/serverClient";

export const supabaseAdmin: any = DEMO
  ? makeAdminClient()
  : createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
