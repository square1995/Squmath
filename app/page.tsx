import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { ROUTES } from "@/lib/constants";

export default async function HomePage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(ROUTES.DASHBOARD);
  }
  redirect(ROUTES.LOGIN);
}
