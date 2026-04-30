import Link from "next/link";

// URL 不正 / 削除済みリソース等の 404 用画面。
export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg shadow-sm p-8 text-center">
        <p className="text-3xl font-bold text-slate-300 mb-2">404</p>
        <h1 className="text-lg font-semibold text-slate-900 mb-3">
          お探しのページは見つかりませんでした
        </h1>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          URL が間違っているか、ページが削除された可能性があります。
        </p>
        <Link
          href="/dashboard"
          className="inline-block px-4 py-2 rounded text-sm bg-slate-900 text-white hover:bg-slate-800"
        >
          ダッシュボードへ戻る
        </Link>
      </div>
    </main>
  );
}
