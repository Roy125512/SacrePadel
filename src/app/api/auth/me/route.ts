import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function getCookieValue(cookieStore: any, name: string) {
  if (cookieStore?.get) return cookieStore.get(name)?.value;
  if (cookieStore?.getAll) {
    const all = cookieStore.getAll();
    const found = Array.isArray(all) ? all.find((c: any) => c?.name === name) : null;
    return found?.value;
  }
  return undefined;
}

export async function GET() {
  const cookieStore: any = await (cookies() as any);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return getCookieValue(cookieStore, name);
        },
        set() {},
        remove() {},
      },
    }
  );

  const { data, error } = await supabase.auth.getUser();
  if (error) return NextResponse.json({ error: error.message }, { status: 401 });

  return NextResponse.json({ user: data.user }, { status: 200 });
}
