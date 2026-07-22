import { createBrowserClient } from "@supabase/ssr";
import { DEMO } from "@/lib/demo/flag";
import { makeBrowserClient } from "@/lib/demo/browserClient";

export function createClient() {
  if (DEMO) return makeBrowserClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createBrowserClient(url, key);
}
