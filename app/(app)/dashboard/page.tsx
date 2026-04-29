import Link from "next/link";

export const runtime = "edge";

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">ダッシュボード</h1>
      <p className="text-sm text-slate-600 mb-6">
        ログインに成功しました。左側のメニューから機能を選んでください。
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
        <Link
          href="/problems"
          className="block p-4 rounded-lg border border-slate-200 bg-white hover:border-slate-400"
        >
          <div className="text-base font-semibold mb-1">問題一覧</div>
          <div className="text-sm text-slate-600">
            登録済みの問題を確認・編集できます
          </div>
        </Link>
        <Link
          href="/problems/new"
          className="block p-4 rounded-lg border border-slate-200 bg-white hover:border-slate-400"
        >
          <div className="text-base font-semibold mb-1">問題を新規作成</div>
          <div className="text-sm text-slate-600">
            タイトルと本文を入力して保存できます
          </div>
        </Link>
      </div>
    </div>
  );
}
