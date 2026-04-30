// エラーハンドリング動作確認用のページ。
// アクセスすると Server Component が必ず例外を投げる → app/error.tsx が表示されるはず。
//
// 動作確認後、このディレクトリごと削除して構わない。

export default function TestErrorPage() {
  throw new Error(
    "[test-error] 意図的に投げたテスト用例外。これは error.tsx の動作確認用です。",
  );
}
