import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guard";
import { ok, err } from "@/lib/api/response";
import type { UpdateProblemBody } from "@/types/api";

export const runtime = "edge";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/problems/[id]  1 件取得
export async function GET(_request: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("problems")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[GET /api/problems/:id] db error", error);
    return err("INTERNAL", "問題の取得に失敗しました", 500);
  }
  if (!data) return err("NOT_FOUND", "問題が見つかりません", 404);

  return ok(data);
}

// PUT /api/problems/[id]  更新
export async function PUT(request: Request, { params }: Ctx) {
  const auth = await requireUser();
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
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("problems")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[PUT /api/problems/:id] db error", error);
    return err("INTERNAL", "更新に失敗しました", 500);
  }
  return ok(data);
}

// DELETE /api/problems/[id]  論理削除(deleted_at をセット)
export async function DELETE(_request: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("problems")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("[DELETE /api/problems/:id] db error", error);
    return err("INTERNAL", "削除に失敗しました", 500);
  }
  return ok({ id });
}
