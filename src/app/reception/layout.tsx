import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";

export default async function ReceptionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?mode=login&next=${encodeURIComponent("/reception")}`);
  }

  const { data: prof } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = (prof?.role ?? "customer").toString();

  if (role !== "owner" && role !== "reception") {
    redirect("/");
  }

  return <>{children}</>;
}
