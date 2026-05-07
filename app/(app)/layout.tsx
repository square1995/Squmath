import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceSupabase } from "@/lib/supabase/service";
import { getEffectiveUser } from "@/lib/auth/effective-user";
import { SignOutButton } from "@/components/ui/SignOutButton";
import { ImpersonationBanner } from "@/components/impersonation/ImpersonationBanner";

// 認証必須ページのレイアウト。
// Server Component で auth + 代理状態をチェック。
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getEffectiveUser();
  if (!me) {
    redirect("/login");
  }

  // 代理対象 staff の表示名を取得(バナー用)
  let targetLabel: string | null = null;
  if (me.isImpersonating && me.impersonation) {
    const service = createServiceSupabase();
    const { data: target } = await service
      .from("users")
      .select("display_name, email")
      .eq("id", me.impersonation.target_user_id)
      .maybeSingle();
    targetLabel = target?.display_name || target?.email || "(不明)";
  }

  const showAdminMenu =
    me.realUserRole === "admin" && !me.isImpersonating;
  const sidebarLabel =
    me.isImpersonating && targetLabel
      ? `${targetLabel} として操作中`
      : me.realUser.email;

  return (
    <div className="min-h-screen flex flex-col">
      {me.isImpersonating && me.impersonation && targetLabel && (
        <ImpersonationBanner
          impersonationId={me.impersonation.id}
          targetLabel={targetLabel}
        />
      )}

      <div className="flex flex-1">
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
            {showAdminMenu && (
              <>
                <div className="px-3 pt-4 pb-1 text-[10px] uppercase tracking-wider text-slate-400">
                  管理者メニュー
                </div>
                <Link
                  href="/admin/users"
                  className="block px-3 py-2 rounded hover:bg-slate-800"
                >
                  ユーザー管理
                </Link>
              </>
            )}
          </nav>
          <div className="px-3 py-4 border-t border-slate-800 text-xs">
            <div className="px-2 mb-2 text-slate-400 truncate">
              {sidebarLabel}
            </div>
            <SignOutButton />
          </div>
        </aside>
        <main className="flex-1 px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
