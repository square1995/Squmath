"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ImpersonationBanner({
  impersonationId,
  targetLabel,
}: {
  impersonationId: string;
  targetLabel: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnd = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/impersonations/${impersonationId}`,
        { method: "DELETE" },
      );
      const json = await res.json();
      if (!json.ok) {
        setError(json.error?.message ?? "終了に失敗しました");
        setBusy(false);
        return;
      }
      router.push("/admin/users");
      router.refresh();
    } catch (e) {
      console.error("[ImpersonationBanner] end failed", e);
      setError("通信に失敗しました");
      setBusy(false);
    }
  };

  return (
    <div className="bg-amber-100 border-b-2 border-amber-500 px-4 py-2 flex items-center gap-3 text-sm">
      <span className="text-amber-900 font-semibold" aria-hidden>
        ⚠️
      </span>
      <span className="flex-1 text-amber-900">
        現在 <strong>{targetLabel}</strong>{" "}
        として代理操作中です。ここでの操作は {targetLabel}{" "}
        の所有として保存されます。
      </span>
      {error && <span className="text-xs text-red-700">{error}</span>}
      <button
        type="button"
        onClick={handleEnd}
        disabled={busy}
        className="px-3 py-1 rounded text-xs bg-amber-700 text-white hover:bg-amber-800 disabled:opacity-50"
      >
        {busy ? "終了中..." : "代理操作を終了"}
      </button>
    </div>
  );
}
