import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Problem } from "@/types/domain";

export const runtime = "edge";

export default async function ProblemsListPage() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("problems")
    .select("*")
    .order("updated_at", { ascending: false });

  const problems = (data as Problem[] | null) ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">問題一覧</h1>
        <Link
          href="/problems/new"
          className="inline-flex items-center px-3 py-1.5 rounded text-sm bg-slate-900 text-white hover:bg-slate-800"
        >
          新規作成
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded border border-red-200 bg-red-50 text-sm text-red-800">
          一覧の取得に失敗しました。再読み込みしてください。
        </div>
      )}

      {problems.length === 0 ? (
        <div className="p-8 rounded border border-dashed border-slate-300 bg-white text-center text-sm text-slate-600">
          まだ問題がありません。「新規作成」から最初の問題を登録してください。
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 bg-white border border-slate-200 rounded">
          {problems.map((p) => (
            <li key={p.id}>
              <Link
                href={`/problems/${p.id}`}
                className="block px-4 py-3 hover:bg-slate-50"
              >
                <div className="font-medium">{p.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  更新: {new Date(p.updated_at).toLocaleString("ja-JP")}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
