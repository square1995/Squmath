import { cookies } from "next/headers";
import { createServiceSupabase } from "@/lib/supabase/service";
import { requireAdmin, IMPERSONATION_COOKIE } from "@/lib/auth/effective-user";
import { ok, err } from "@/lib/api/response";
import { TABLE } from "@/lib/constants";

type Ctx = { params: Promise<{ id: string }> };

// DELETE /api/admin/impersonations/[id]
// 代理操作セッションを終了する。
export async function DELETE(_request: Request, { params }: Ctx) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const service = createServiceSupabase();

  const { data, error } = await service
    .from(TABLE.IMPERSONATIONS)
    .update({ ended_at: new Date().toISOString() })
    .eq("id", id)
    .eq("admin_user_id", auth.user.realUser.id)
    .is("ended_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[DELETE /api/admin/impersonations/:id] db error", error);
    return err("INTERNAL", "代理操作の終了に失敗しました", 500);
  }

  // 対象が見つからなくても Cookie は削除して通常モードに戻す
  const cookieStore = await cookies();
  cookieStore.set({
    name: IMPERSONATION_COOKIE,
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return ok({ id: data?.id ?? id });
}
