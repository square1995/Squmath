import { cookies } from "next/headers";
import { createServiceSupabase } from "@/lib/supabase/service";
import { requireAdmin, IMPERSONATION_COOKIE } from "@/lib/auth/effective-user";
import { ok, err } from "@/lib/api/response";

type StartBody = {
  target_user_id?: string;
  reason?: string;
};

// POST /api/admin/impersonations
// 代理操作セッションを開始する。
// 1 admin = 同時に 1 セッションのみ。既存の active セッションは自動で終了させる。
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const body = (await request.json().catch(() => null)) as StartBody | null;
  if (!body || typeof body.target_user_id !== "string") {
    return err("VALIDATION", "対象ユーザーが指定されていません", 400);
  }
  if (body.target_user_id === auth.user.realUser.id) {
    return err("VALIDATION", "自分を対象にはできません", 400);
  }

  const service = createServiceSupabase();

  const { data: target, error: targetError } = await service
    .from("users")
    .select("id, email, display_name")
    .eq("id", body.target_user_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (targetError) {
    console.error("[POST /api/admin/impersonations] target lookup", targetError);
    return err("INTERNAL", "対象ユーザーの確認に失敗しました", 500);
  }
  if (!target) {
    return err("NOT_FOUND", "対象ユーザーが見つかりません", 404);
  }

  // 既存の active セッションを終了
  const { error: closeError } = await service
    .from("impersonations")
    .update({ ended_at: new Date().toISOString() })
    .eq("admin_user_id", auth.user.realUser.id)
    .is("ended_at", null);

  if (closeError) {
    console.error(
      "[POST /api/admin/impersonations] close existing failed",
      closeError,
    );
    return err("INTERNAL", "代理操作の開始に失敗しました", 500);
  }

  const reason =
    typeof body.reason === "string" && body.reason.trim() !== ""
      ? body.reason.trim()
      : null;

  const { data: imp, error: insertError } = await service
    .from("impersonations")
    .insert({
      admin_user_id: auth.user.realUser.id,
      target_user_id: target.id,
      reason,
    })
    .select("id, target_user_id, started_at")
    .single();

  if (insertError || !imp) {
    console.error(
      "[POST /api/admin/impersonations] insert failed",
      insertError,
    );
    return err("INTERNAL", "代理操作の開始に失敗しました", 500);
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: IMPERSONATION_COOKIE,
    value: imp.id,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });

  return ok({
    impersonation_id: imp.id,
    started_at: imp.started_at,
    target_user: {
      id: target.id,
      email: target.email,
      display_name: target.display_name,
    },
  });
}
