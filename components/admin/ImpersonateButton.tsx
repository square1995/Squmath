"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ImpersonateButton({
  targetUserId,
  targetLabel,
}: {
  targetUserId: string;
  targetLabel: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (busy) return;
    if (
      !window.confirm(
        `${targetLabel} として代理操作を開始しますか?\n` +
          "  ・操作した内容は本人の所有として保存されます\n" +
          "  ・終了するまで画面上部にバナーが表示されます",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/impersonations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target_user_id: targetUserId }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error?.message ?? "代理操作の開始に失敗しました");
        setBusy(false);
        return;
      }
      // 開始後はダッシュボードへ。バナーが上部に出る
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      console.error("[ImpersonateButton] failed", e);
      setError("通信に失敗しました。再度お試しください");
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="px-3 py-1.5 rounded text-sm bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {busy ? "開始中..." : "代理操作"}
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
