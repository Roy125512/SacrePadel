import { createBrowserClient } from "@supabase/ssr";
import { DEMO } from "@/lib/demo/flag";
import { makeBrowserClient } from "@/lib/demo/browserClient";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabaseBrowser: any = DEMO ? makeBrowserClient() : createBrowserClient(url, key);
