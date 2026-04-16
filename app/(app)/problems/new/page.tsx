"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MathMarkdownRenderer } from "@/components/math/MathMarkdownRenderer";
import { saveProblem } from "../actions";

const SUBJECTS = ["数学I", "数学A", "数学II", "数学B", "数学III", "数学C", "その他"];
const DIFFICULTIES = [1, 2, 3, 4, 5];

export default function NewProblemPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [contentLatex, setContentLatex] = useState("");
  const [subject, setSubject] = useState("");
  const [difficulty, setDifficulty] = useState<number>(3);
  const [file, setFile] = useState<File | null>(null);
  const [ocrResult, setOcrResult] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOcr() {
    if (!file) return;
    setOcrLoading(true);
    setError(null);
    setOcrResult(null);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/ocr", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "OCRに失敗しました");
      setOcrResult(data.latex);
      setContentLatex(data.latex);
    } catch (err) {
      setError(err instanceof Error ? err.message : "OCRに失敗しました");
    } finally {
      setOcrLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const result = await saveProblem({
      title,
      content_latex: contentLatex,
      subject: subject || null,
      difficulty,
    });

    if (result?.error) {
      setError(result.error);
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">問題を追加</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              タイトル
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="例: 二次方程式の解の公式"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              問題文・数式（LaTeX）
            </label>
            <textarea
              value={contentLatex}
              onChange={(e) => setContentLatex(e.target.value)}
              rows={6}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder={`x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}`}
            />
          </div>

          {/* OCR section */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">
              AI OCR（画像・PDFから問題を読み取る）
            </p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setOcrResult(null);
              }}
              className="text-sm text-gray-600"
            />
            <p className="text-xs text-gray-400">
              JPG・PNG・WebP・GIF・PDF に対応
            </p>
            <button
              type="button"
              onClick={handleOcr}
              disabled={!file || ocrLoading}
              className="bg-gray-700 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-gray-800 disabled:opacity-40 transition-colors"
            >
              {ocrLoading ? "読み取り中..." : "OCRで読み取る"}
            </button>

            {/* OCR result editable area */}
            {ocrResult !== null && (
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-medium text-gray-600">
                  読み取り結果（編集できます）
                </label>
                <textarea
                  value={contentLatex}
                  onChange={(e) => setContentLatex(e.target.value)}
                  rows={6}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                科目
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">選択してください</option>
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                難易度
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-primary-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "保存中..." : "保存"}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="border border-gray-300 text-gray-700 px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </form>

        {/* Preview */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="text-sm font-medium text-gray-500 mb-4">
            プレビュー
          </h2>
          {contentLatex ? (
            <MathMarkdownRenderer content={contentLatex} />
          ) : (
            <div className="text-center py-12 text-gray-300">
              <div className="text-4xl mb-2">∑</div>
              <p className="text-sm">入力するとプレビューが表示されます</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
