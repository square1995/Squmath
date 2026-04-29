import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "edge";

export default async function HomePage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }
  redirect("/login");
}
