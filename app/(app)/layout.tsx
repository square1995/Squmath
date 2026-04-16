import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col no-print">
        <div className="p-4 border-b border-gray-100">
          <Link href="/dashboard" className="text-xl font-bold text-primary-700">
            Squmath
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <span>📊</span> ダッシュボード
          </Link>
          <Link
            href="/problems"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <span>📝</span> 問題一覧
          </Link>
          <Link
            href="/problems/new"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <span>➕</span> 問題を追加
          </Link>
          <Link
            href="/print"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <span>🖨️</span> 印刷プレビュー
          </Link>
        </nav>
        <div className="p-3 border-t border-gray-100 space-y-2">
          <p className="text-xs text-gray-400 px-3 truncate">{user.email}</p>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-colors"
            >
              ログアウト
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-6">{children}</div>
      </main>
    </div>
  );
}
