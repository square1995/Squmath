import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ count: problemCount }, { count: worksheetCount }] = await Promise.all([
    supabase.from("problems").select("*", { count: "exact", head: true }),
    supabase.from("worksheets").select("*", { count: "exact", head: true }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">ダッシュボード</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          {
            label: "問題数",
            value: problemCount ?? 0,
            icon: "📝",
            href: "/problems",
          },
          {
            label: "プリント数",
            value: worksheetCount ?? 0,
            icon: "📄",
            href: "/print",
          },
          {
            label: "今月作成",
            value: 0,
            icon: "📅",
            href: "/problems",
          },
        ].map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="text-2xl mb-2">{stat.icon}</div>
            <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
            <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          クイックアクション
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/problems/new"
            className="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-primary-400 hover:bg-primary-50 transition-colors group"
          >
            <span className="text-2xl">✏️</span>
            <div>
              <p className="font-medium text-gray-800 group-hover:text-primary-700">
                問題を作成
              </p>
              <p className="text-xs text-gray-500">LaTeX入力またはAI OCR</p>
            </div>
          </Link>
          <Link
            href="/print"
            className="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-primary-400 hover:bg-primary-50 transition-colors group"
          >
            <span className="text-2xl">🖨️</span>
            <div>
              <p className="font-medium text-gray-800 group-hover:text-primary-700">
                プリントを印刷
              </p>
              <p className="text-xs text-gray-500">A4/B4レイアウトで出力</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
