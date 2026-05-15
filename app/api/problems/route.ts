import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import {
  requireEffectiveUser,
  getWriteClient,
} from "@/lib/auth/effective-user";
import { ok, err } from "@/lib/api/response";
import { TABLE, SORT_MAP, PAGINATION } from "@/lib/constants";
import type {
  CreateProblemBody,
  ProblemListResponse,
  ProblemListSort,
} from "@/types/api";
import type { Problem } from "@/types/domain";

// GET /api/problems  一覧取得(削除済みは除外)
// クエリ: q / subject / school_level / grade / unit / difficulty / sort / limit / offset
export async function GET(request: Request) {
  const auth = await requireEffectiveUser();
  if (auth.response) return auth.response;

  const sp = new URL(request.url).searchParams;

  const q = sp.get("q")?.trim() ?? "";
  const subject = sp.get("subject")?.trim() ?? "";
  const schoolLevel = sp.get("school_level")?.trim() ?? "";
  const gradeStr = sp.get("grade")?.trim() ?? "";
  const unit = sp.get("unit")?.trim() ?? "";
  const difficultyStr = sp.get("difficulty")?.trim() ?? "";
  const sortKey = (sp.get("sort")?.trim() ?? "updated_desc") as ProblemListSort;

  const limitRaw = parseInt(sp.get("limit") ?? "", 10);
  const offsetRaw = parseInt(sp.get("offset") ?? "", 10);
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, PAGINATION.MAX_LIMIT)
      : PAGINATION.DEFAULT_LIMIT;
  const offset =
    Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

  const sortRule = SORT_MAP[sortKey] ?? SORT_MAP.updated_desc;

  // 代理中は service_role で読み、明示的に「自分 or master」で絞る
  const supabase = auth.user.isImpersonating
    ? createServiceSupabase()
    : await createServerSupabase();

  let query = supabase.from(TABLE.PROBLEMS).select("*").is("deleted_at", null);

  if (auth.user.isImpersonating) {
    query = query.or(
      `owner_id.is.null,owner_id.eq.${auth.user.effectiveUserId}`,
    );
  }

  if (q) query = query.ilike("title", `%${q}%`);
  if (subject) query = query.eq("subject", subject);
  if (schoolLevel) query = query.eq("school_level", schoolLevel);
  if (gradeStr) {
    const g = parseInt(gradeStr, 10);
    if (Number.isFinite(g)) query = query.eq("grade", g);
  }
  if (unit) query = query.eq("unit", unit);
  if (difficultyStr) {
    const d = parseInt(difficultyStr, 10);
    if (Number.isFinite(d)) query = query.eq("difficulty", d);
  }

  query = query
    .order(sortRule.column, { ascending: sortRule.ascending })
    .range(offset, offset + limit);

  const { data, error } = await query;

  if (error) {
    console.error("[GET /api/problems] db error", error);
    return err("INTERNAL", "問題の取得に失敗しました", 500);
  }

  const rows = (data ?? []) as Problem[];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  const response: ProblemListResponse = {
    items,
    next_offset: hasMore ? offset + limit : null,
    returned: items.length,
  };
  return ok(response);
}

// POST /api/problems  新規作成(常に個人問題: owner_id = effectiveUserId)
export async function POST(request: Request) {
  const auth = await requireEffectiveUser();
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

  const supabase = await getWriteClient(auth.user);
  const { data, error } = await supabase
    .from(TABLE.PROBLEMS)
    .insert({
      owner_id: auth.user.effectiveUserId,
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
