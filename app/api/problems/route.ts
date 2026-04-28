import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guard";
import { ok, err } from "@/lib/api/response";
import type { CreateProblemBody } from "@/types/api";

export const runtime = "edge";

// GET /api/problems  自分の問題 + master を一覧で返す(deleted_at IS NULL のみ)
export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("problems")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[GET /api/problems] db error", error);
    return err("INTERNAL", "問題の取得に失敗しました", 500);
  }

  return ok(data ?? []);
}

// POST /api/problems  新規作成
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const body = (await request.json().catch(() => null)) as
    | CreateProblemBody
    | null;
  if (
    !body ||
    typeof body.title !== "string" ||
    body.title.trim() === ""
  ) {
    return err("VALIDATION", "タイトルを入力してください", 400);
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("problems")
    .insert({
      owner_id: auth.user.id,
      title: body.title.trim(),
      content: body.content ?? {},
      meta: body.meta ?? {},
    })
    .select()
    .single();

  if (error) {
    console.error("[POST /api/problems] db error", error);
    return err("INTERNAL", "保存に失敗しました", 500);
  }

  return ok(data, 200);
}
