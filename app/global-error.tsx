"use client";

import { useEffect } from "react";

// RootLayout 自体が壊れた時の最終フォールバック。
// `<html>` と `<body>` を自前で書く必要がある(これがないと真っ白な画面になる)。
//
// ここに来るのは普通のエラーではなく、layout.tsx が例外を投げた等の極めて稀なケース。
// なので Tailwind 等の依存も避け、最小限の inline スタイルで固める。

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error.tsx] uncaught root error", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="ja">
      <body
        style={{
          margin: 0,
          padding: "40px 16px",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif',
          background: "#f8fafc",
          color: "#0f172a",
          minHeight: "100vh",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            margin: "0 auto",
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: 32,
          }}
        >
          <h1 style={{ fontSize: 20, marginTop: 0, marginBottom: 12 }}>
            ⚠ 重大なエラーが発生しました
          </h1>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.7,
              color: "#334155",
              marginBottom: 20,
            }}
          >
            アプリの根本的な部分でエラーが発生しました。
            <br />
            ブラウザを再読み込みしてください。直らない場合は管理者にお知らせください。
          </p>
          <a
            href="/"
            style={{
              display: "inline-block",
              padding: "8px 16px",
              background: "#0f172a",
              color: "#fff",
              textDecoration: "none",
              borderRadius: 4,
              fontSize: 14,
            }}
          >
            トップに戻る
          </a>
          {error.digest && (
            <p
              style={{
                fontSize: 12,
                color: "#64748b",
                marginTop: 24,
                fontFamily: "monospace",
              }}
            >
              エラー ID: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
