import { redirect } from "next/navigation";
import { createServiceSupabase } from "@/lib/supabase/service";
import { getEffectiveUser } from "@/lib/auth/effective-user";
import { ImpersonateButton } from "@/components/admin/ImpersonateButton";
import type { AppUser } from "@/types/domain";

// admin 専用: 登録ユーザー一覧 + 代理操作ボタン
export default async function AdminUsersPage() {
  const me = await getEffectiveUser();
  if (!me) redirect("/login");
  if (me.realUserRole !== "admin") {
    redirect("/dashboard");
  }

  const service = createServiceSupabase();
  const { data, error } = await service
    .from("users")
    .select("id, email, display_name, role, created_at, updated_at, deleted_at")
    .is("deleted_at", null)
    .neq("id", me.realUser.id)
    .order("display_name", { ascending: true, nullsFirst: false });

  const users = (data as AppUser[] | null) ?? [];

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold">ユーザー管理</h1>
        <p className="text-sm text-slate-600 mt-1">
          登録された staff の一覧です。「代理操作」を押すと、その人として画面操作ができます(操作内容は本人の所有として保存されます)。
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded border border-red-200 bg-red-50 text-sm text-red-800">
          ユーザー一覧の取得に失敗しました。再読み込みしてください。
        </div>
      )}

      {me.isImpersonating && (
        <div className="mb-4 p-3 rounded border border-amber-300 bg-amber-50 text-sm text-amber-900">
          現在すでに代理操作中です。新しい代理を開始すると、現在の代理は自動で終了します。
        </div>
      )}

      {users.length === 0 ? (
        <div className="p-8 rounded border border-dashed border-slate-300 bg-white text-center text-sm text-slate-600">
          自分以外の登録ユーザーはまだいません。
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 bg-white border border-slate-200 rounded">
          {users.map((u) => {
            const label = u.display_name || u.email;
            return (
              <li key={u.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1">
                  <div className="font-medium">{label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {u.email}
                    <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-100">
                      {u.role === "admin" ? "管理者" : "スタッフ"}
                    </span>
                  </div>
                </div>
                <ImpersonateButton
                  targetUserId={u.id}
                  targetLabel={label}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
