"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Problem } from "@/types/domain";
import { MathRenderer } from "@/components/math/MathRenderer";

export function ProblemEditor({ problem }: { problem: Problem }) {
  const router = useRouter();
  const [title, setTitle] = useState(problem.title);
  const [bodyLatex, setBodyLatex] = useState(problem.content.body_latex ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/problems/${problem.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          content: {
            ...problem.content,
            kind: "math_problem",
            version: problem.content.version ?? 1,
            body_latex: bodyLatex,
          },
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setErrorMessage(json.error?.message ?? "保存に失敗しました");
        return;
      }
      router.refresh();
    } catch (e) {
      console.error("[problems/[id]] save failed", e);
      setErrorMessage("通信に失敗しました。再度お試しください");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("この問題を削除します。よろしいですか?")) return;
    setDeleting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/problems/${problem.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.ok) {
        setErrorMessage(json.error?.message ?? "削除に失敗しました");
        setDeleting(false);
        return;
      }
      router.push("/problems");
    } catch (e) {
      console.error("[problems/[id]] delete failed", e);
      setErrorMessage("通信に失敗しました。再度お試しください");
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">問題を編集</h1>

      {errorMessage && (
        <div className="mb-4 p-3 rounded border border-red-200 bg-red-50 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">タイトル</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 bg-white"
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
          />
        </div>

        {bodyLatex.trim() !== "" && (
          <div>
            <div className="text-sm font-medium mb-1">プレビュー</div>
            <div className="p-4 rounded border border-slate-200 bg-white">
              <MathRenderer formula={bodyLatex} />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || title.trim() === ""}
              className="px-4 py-2 rounded text-sm bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "保存中..." : "保存"}
            </button>
            <Link
              href="/problems"
              className="px-4 py-2 rounded text-sm border border-slate-300 hover:bg-slate-50"
            >
              一覧へ戻る
            </Link>
          </div>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="px-3 py-2 rounded text-sm border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {deleting ? "削除中..." : "削除"}
          </button>
        </div>
      </div>
    </div>
  );
}
