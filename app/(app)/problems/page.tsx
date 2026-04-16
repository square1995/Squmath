import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MathMarkdownRenderer } from "@/components/math/MathMarkdownRenderer";

export default async function ProblemsPage() {
  const supabase = await createClient();
  const { data: problems, error } = await supabase
    .from("problems")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">問題一覧</h1>
        <Link
          href="/problems/new"
          className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          + 問題を追加
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm mb-4">
          データの読み込みに失敗しました。Supabaseの接続設定を確認してください。
        </div>
      )}

      {!problems || problems.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">📝</div>
          <p className="text-lg font-medium">まだ問題がありません</p>
          <p className="text-sm mt-1">最初の問題を追加しましょう</p>
          <Link
            href="/problems/new"
            className="inline-block mt-4 bg-primary-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            問題を追加
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {problems.map((problem) => (
            <div
              key={problem.id}
              className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 mb-2">
                    {problem.title}
                  </h3>
                  {problem.content_latex && (
                    <div className="text-gray-700 overflow-x-auto">
                      <MathMarkdownRenderer content={problem.content_latex} />
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  {problem.subject && (
                    <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
                      {problem.subject}
                    </span>
                  )}
                  {problem.difficulty && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      難易度 {problem.difficulty}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
