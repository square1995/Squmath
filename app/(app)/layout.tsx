import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/ui/SignOutButton";

// 認証必須ページのレイアウト。
// Server Component で auth チェックを行い、未ログインなら /login へリダイレクト。
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-slate-900 text-slate-100 flex flex-col">
        <div className="px-5 py-4 border-b border-slate-800">
          <Link href="/dashboard" className="text-lg font-bold">
            Squmath
          </Link>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1 text-sm">
          <Link
            href="/dashboard"
            className="block px-3 py-2 rounded hover:bg-slate-800"
          >
            ダッシュボード
          </Link>
          <Link
            href="/problems"
            className="block px-3 py-2 rounded hover:bg-slate-800"
          >
            問題一覧
          </Link>
        </nav>
        <div className="px-3 py-4 border-t border-slate-800 text-xs">
          <div className="px-2 mb-2 text-slate-400 truncate">{user.email}</div>
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 px-8 py-6">{children}</main>
    </div>
  );
}
