"use client";

import { useEffect } from "react";
import Link from "next/link";

// アプリ内で発生した予期せぬ例外をキャッチして、利用者に分かりやすい画面を出す。
// `error.tsx` は Client Component である必要がある(Next.js の制約)。
//
// ※ ここでは API 呼び出し等の副作用を起こさないこと(無限ループの危険)。
//   ログは Cloudflare Workers 側ですでに console.error で出ているので、ここでは記録のみ。

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Cloudflare Logs に残るログ(クライアントの window.console は Cloudflare では
    // 直接見えないが、念のため出力しておく)
    console.error("[error.tsx] uncaught error", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-lg shadow-sm p-8">
        <div className="flex items-center gap-3 mb-4">
          <span aria-hidden className="text-2xl">⚠</span>
          <h1 className="text-xl font-bold text-slate-900">
            システムエラーが発生しました
          </h1>
        </div>

        <p className="text-sm text-slate-700 mb-6 leading-relaxed">
          申し訳ありません、想定外のエラーで処理を完了できませんでした。
          <br />
          下のボタンから再読み込みするか、ダッシュボードに戻ってください。
        </p>

        <div className="flex flex-wrap gap-3 mb-6">
          <button
            type="button"
            onClick={reset}
            className="px-4 py-2 rounded text-sm bg-slate-900 text-white hover:bg-slate-800"
          >
            画面を再読み込み
          </button>
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded text-sm border border-slate-300 hover:bg-slate-50"
          >
            ダッシュボードへ戻る
          </Link>
        </div>

        <div className="border-t border-slate-200 pt-4 text-xs text-slate-500">
          <p className="mb-1">
            問題が続く場合は管理者にお知らせください。
          </p>
          {error.digest && (
            <p className="font-mono">
              エラー ID: <span className="text-slate-700">{error.digest}</span>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
