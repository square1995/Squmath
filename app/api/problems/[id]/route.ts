import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import {
  requireEffectiveUser,
  getWriteClient,
} from "@/lib/auth/effective-user";
import { ok, err } from "@/lib/api/response";
import { TABLE } from "@/lib/constants";
import type { UpdateProblemBody } from "@/types/api";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/problems/[id]  1 件取得
export async function GET(_request: Request, { params }: Ctx) {
  const auth = await requireEffectiveUser();
  if (auth.response) return auth.response;

  const { id } = await params;

  // 代理中は service_role で読んで明示的にチェック
  const supabase = auth.user.isImpersonating
    ? createServiceSupabase()
    : await createServerSupabase();

  const { data, error } = await supabase
    .from(TABLE.PROBLEMS)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[GET /api/problems/:id] db error", error);
    return err("INTERNAL", "問題の取得に失敗しました", 500);
  }
  if (!data) return err("NOT_FOUND", "問題が見つかりません", 404);

  if (auth.user.isImpersonating) {
    if (
      data.owner_id !== null &&
      data.owner_id !== auth.user.effectiveUserId
    ) {
      return err("NOT_FOUND", "問題が見つかりません", 404);
    }
  }

  return ok(data);
}

// PUT /api/problems/[id]  更新(自分の個人問題のみ)
// master 問題への編集自動コピーは Step B-3 で実装する。今は staff の通常編集のみ。
export async function PUT(request: Request, { params }: Ctx) {
  const auth = await requireEffectiveUser();
  if (auth.response) return auth.response;

  const body = (await request.json().catch(() => null)) as
    | UpdateProblemBody
    | null;
  if (!body) return err("VALIDATION", "リクエスト内容が不正です", 400);

  const update: Record<string, unknown> = {};
  if (typeof body.title === "string") {
    if (body.title.trim() === "") {
      return err("VALIDATION", "タイトルを空にできません", 400);
    }
    update.title = body.title.trim();
  }
  if (body.content !== undefined) update.content = body.content;
  if (body.meta !== undefined) update.meta = body.meta;

  if (Object.keys(update).length === 0) {
    return err("VALIDATION", "更新する項目がありません", 400);
  }

  const { id } = await params;
  const supabase = await getWriteClient(auth.user);

  // 代理中は RLS が効かないため、effectiveUserId を必ずフィルタに入れる
  const { data, error } = await supabase
    .from(TABLE.PROBLEMS)
    .update(update)
    .eq("id", id)
    .eq("owner_id", auth.user.effectiveUserId)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[PUT /api/problems/:id] db error", error);
    return err("INTERNAL", "更新に失敗しました", 500);
  }
  if (!data) {
    return err(
      "NOT_FOUND",
      "問題が見つからないか、編集権限がありません",
      404,
    );
  }
  return ok(data);
}

// DELETE /api/problems/[id]  論理削除(自分の個人問題のみ)
export async function DELETE(_request: Request, { params }: Ctx) {
  const auth = await requireEffectiveUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const supabase = await getWriteClient(auth.user);

  const { data, error } = await supabase
    .from(TABLE.PROBLEMS)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", auth.user.effectiveUserId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[DELETE /api/problems/:id] db error", error);
    return err("INTERNAL", "削除に失敗しました", 500);
  }
  if (!data) {
    return err(
      "NOT_FOUND",
      "問題が見つからないか、削除権限がありません",
      404,
    );
  }
  return ok({ id: data.id });
}
