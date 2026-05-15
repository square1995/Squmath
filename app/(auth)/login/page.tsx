"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { APP_NAME } from "@/lib/constants";

function LoginInner() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error");
  const [signingIn, setSigningIn] = useState(false);

  const handleGoogleLogin = async () => {
    setSigningIn(true);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      console.error("[login] signInWithOAuth failed", error);
      setSigningIn(false);
    }
    // 成功時はリダイレクトされるのでローディングは続けて OK
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-lg shadow-sm p-8">
        <h1 className="text-2xl font-bold mb-2 text-center">{APP_NAME}</h1>
        <p className="text-sm text-slate-600 mb-6 text-center">
          ログインして利用を開始してください
        </p>

        {errorCode === "not_allowed" && (
          <div className="mb-4 p-3 rounded border border-red-200 bg-red-50 text-sm text-red-800">
            このメールアドレスではログインできません。管理者にお問い合わせください。
          </div>
        )}

        {errorCode === "callback_failed" && (
          <div className="mb-4 p-3 rounded border border-red-200 bg-red-50 text-sm text-red-800">
            ログイン処理に失敗しました。時間をおいて再度お試しください。
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={signingIn}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          {signingIn ? "リダイレクト中..." : "Google でログイン"}
        </button>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
