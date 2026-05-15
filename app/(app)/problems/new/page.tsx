"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API, ROUTES } from "@/lib/constants";

export default function NewProblemPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [bodyLatex, setBodyLatex] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setErrorMessage(null);

    try {
      const res = await fetch(API.PROBLEMS, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          content: { kind: "math_problem", version: 1, body_latex: bodyLatex },
          meta: { subject: "math" },
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setErrorMessage(json.error?.message ?? "保存に失敗しました");
        setSaving(false);
        return;
      }
      router.push(`${ROUTES.PROBLEMS}/${json.data.id}`);
    } catch (e) {
      console.error("[problems/new] save failed", e);
      setErrorMessage("通信に失敗しました。再度お試しください");
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">問題を新規作成</h1>

      {errorMessage && (
        <div className="mb-4 p-3 rounded border border-red-200 bg-red-50 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            タイトル<span className="text-red-600 ml-1">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 bg-white"
            placeholder="例: 二次方程式の応用"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            問題本文 (LaTeX)
          </label>
          <textarea
            value={bodyLatex}
            onChange={(e) => setBodyLatex(e.target.value)}
            rows={10}
            className="w-full rounded border border-slate-300 px-3 py-2 bg-white font-mono text-sm"
            placeholder="次の方程式を解け。\\(x^2 + 2x - 3 = 0\\)"
          />
          <p className="text-xs text-slate-500 mt-1">
            数式は LaTeX で記述します(例: <code>\\(x^2\\)</code>)。Phase 4
            で MathLive 編集に置き換えます。
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || title.trim() === ""}
            className="px-4 py-2 rounded text-sm bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "保存中..." : "保存"}
          </button>
          <Link
            href={ROUTES.PROBLEMS}
            className="px-4 py-2 rounded text-sm border border-slate-300 hover:bg-slate-50"
          >
            キャンセル
          </Link>
        </div>
      </div>
    </div>
  );
}
