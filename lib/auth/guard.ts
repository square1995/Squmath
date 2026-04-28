import { createServerSupabase } from "@/lib/supabase/server";
import { err } from "@/lib/api/response";
import type { User } from "@supabase/supabase-js";

// Route Handler で「ログイン必須」を表現する。
// 戻り値の response が null でなければ、それをそのまま return する。
export async function requireUser(): Promise<
  { user: User; response: null } | { user: null; response: Response }
> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      response: err("UNAUTHORIZED", "ログインが必要です", 401),
    };
  }
  return { user, response: null };
}
