import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { getEffectiveUser } from "@/lib/auth/effective-user";
import { ROUTES, TABLE, SORT_MAP, PAGINATION } from "@/lib/constants";
import type { Problem } from "@/types/domain";
import type { ProblemListSort } from "@/types/api";
import { ProblemFilters } from "@/components/problems/ProblemFilters";

type SearchParams = Promise<{
  q?: string;
  subject?: string;
  school_level?: string;
  grade?: string;
  unit?: string;
  difficulty?: string;
  sort?: string;
}>;

function schoolLevelLabel(s: string | null): string | null {
  if (s === "junior") return "中学";
  if (s === "high") return "高校";
  return null;
}

export default async function ProblemsListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const user = await getEffectiveUser();
  if (!user) redirect(ROUTES.LOGIN);

  const supabase = user.isImpersonating
    ? createServiceSupabase()
    : await createServerSupabase();

  let query = supabase.from(TABLE.PROBLEMS).select("*").is("deleted_at", null);

  if (user.isImpersonating) {
    query = query.or(
      `owner_id.is.null,owner_id.eq.${user.effectiveUserId}`,
    );
  }

  const q = sp.q?.trim();
  if (q) query = query.ilike("title", `%${q}%`);
  if (sp.subject) query = query.eq("subject", sp.subject);
  if (sp.school_level) query = query.eq("school_level", sp.school_level);
  if (sp.grade) {
    const g = parseInt(sp.grade, 10);
    if (Number.isFinite(g)) query = query.eq("grade", g);
  }
  if (sp.unit) query = query.eq("unit", sp.unit);
  if (sp.difficulty) {
    const d = parseInt(sp.difficulty, 10);
    if (Number.isFinite(d)) query = query.eq("difficulty", d);
  }

  const sortKey = (sp.sort ?? "updated_desc") as ProblemListSort;
  const sortRule = SORT_MAP[sortKey] ?? SORT_MAP.updated_desc;

  query = query
    .order(sortRule.column, { ascending: sortRule.ascending })
    .range(0, PAGINATION.DEFAULT_LIMIT);

  const { data, error } = await query;
  const rows = (data as Problem[] | null) ?? [];
  const hasMore = rows.length > PAGINATION.DEFAULT_LIMIT;
  const problems = hasMore ? rows.slice(0, PAGINATION.DEFAULT_LIMIT) : rows;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">問題一覧</h1>
        <Link
          href={ROUTES.PROBLEMS_NEW}
          className="inline-flex items-center px-3 py-1.5 rounded text-sm bg-slate-900 text-white hover:bg-slate-800"
        >
          新規作成
        </Link>
      </div>

      <ProblemFilters />

      {error && (
        <div className="mb-4 p-3 rounded border border-red-200 bg-red-50 text-sm text-red-800">
          一覧の取得に失敗しました。再読み込みしてください。
        </div>
      )}

      <div className="text-xs text-slate-500 mb-2">
        表示中: {problems.length} 件
        {hasMore && (
          <span className="ml-1 text-amber-700">
            (上限 {PAGINATION.DEFAULT_LIMIT} 件で打ち切り。さらに絞り込んでください)
          </span>
        )}
      </div>

      {problems.length === 0 ? (
        <div className="p-8 rounded border border-dashed border-slate-300 bg-white text-center text-sm text-slate-600">
          条件に一致する問題はありません。
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 bg-white border border-slate-200 rounded">
          {problems.map((p) => {
            const level = schoolLevelLabel(p.school_level);
            return (
              <li key={p.id}>
                <Link
                  href={`/problems/${p.id}`}
                  className="block px-4 py-3 hover:bg-slate-50"
                >
                  <div className="font-medium">{p.title}</div>
                  <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                    {(level || p.grade) && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                        {level ?? ""}
                        {p.grade ? `${p.grade}年` : ""}
                      </span>
                    )}
                    {p.unit && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                        {p.unit}
                      </span>
                    )}
                    {p.difficulty && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800">
                        {"★".repeat(p.difficulty)}
                      </span>
                    )}
                    <span>
                      更新: {new Date(p.updated_at).toLocaleString("ja-JP")}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
