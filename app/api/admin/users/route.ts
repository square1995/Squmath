import { createServiceSupabase } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/auth/effective-user";
import { ok, err } from "@/lib/api/response";
import { TABLE } from "@/lib/constants";
import type { AppUser } from "@/types/domain";

// GET /api/admin/users  登録ユーザー一覧(自分以外、削除済み除外)
// admin のみ閲覧可。/admin/users 画面の代理操作対象一覧用。
export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const service = createServiceSupabase();
  const { data, error } = await service
    .from(TABLE.USERS)
    .select("id, email, display_name, role, created_at, updated_at, deleted_at")
    .is("deleted_at", null)
    .neq("id", auth.user.realUser.id)
    .order("display_name", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("[GET /api/admin/users] db error", error);
    return err("INTERNAL", "ユーザー一覧の取得に失敗しました", 500);
  }

  return ok((data ?? []) as AppUser[]);
}
