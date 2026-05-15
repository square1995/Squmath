import { createServiceSupabase } from "@/lib/supabase/service";
import { requireEffectiveUser } from "@/lib/auth/effective-user";
import { ok, err } from "@/lib/api/response";
import { TABLE } from "@/lib/constants";

// GET /api/me/impersonation
// 現在のセッションが代理中かどうか + 代理対象ユーザー情報を返す。
// レイアウトのバナー描画など、フロント表示用。
export async function GET() {
  const auth = await requireEffectiveUser();
  if (auth.response) return auth.response;

  if (!auth.user.isImpersonating || !auth.user.impersonation) {
    return ok({
      is_impersonating: false,
      target_user: null,
      impersonation_id: null,
    });
  }

  const service = createServiceSupabase();
  const { data: target, error } = await service
    .from(TABLE.USERS)
    .select("id, email, display_name")
    .eq("id", auth.user.impersonation.target_user_id)
    .maybeSingle();

  if (error) {
    console.error("[GET /api/me/impersonation] target lookup", error);
    return err("INTERNAL", "代理対象の取得に失敗しました", 500);
  }

  return ok({
    is_impersonating: true,
    impersonation_id: auth.user.impersonation.id,
    target_user: target ?? null,
  });
}
