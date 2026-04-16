"use client";

import { createClient } from "@/lib/supabase/client";
import { MathMarkdownRenderer } from "@/components/math/MathMarkdownRenderer";

export default async function PrintPage() {
  const supabase = await createClient();
  const { data: problems } = await supabase
    .from("problems")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div>
      {/* Controls - hidden on print */}
      <div className="no-print flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">印刷プレビュー</h1>
        <button
          onClick={() => window.print()}
          className="bg-primary-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          🖨️ 印刷する
        </button>
      </div>

      {/* Print sheet */}
      <div
        id="print-sheet"
        className="bg-white rounded-xl border border-gray-200 p-8 max-w-3xl mx-auto"
        style={{ minHeight: "297mm" }}
      >
        {/* Sheet header */}
        <div className="text-center mb-8 pb-4 border-b-2 border-gray-900">
          <h1 className="text-2xl font-bold">数学プリント</h1>
          <div className="flex justify-between mt-3 text-sm text-gray-600">
            <span>名前: _______________________</span>
            <span>日付: _______________________</span>
            <span>得点: _______ / {problems?.length ?? 0}点</span>
          </div>
        </div>

        {/* Problems */}
        {!problems || problems.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="no-print">問題がありません。先に問題を追加してください。</p>
          </div>
        ) : (
          <div className="space-y-8">
            {problems.map((problem, index) => (
              <div key={problem.id} className="break-inside-avoid">
                <div className="flex items-start gap-3">
                  <span className="font-bold text-lg min-w-[2rem]">
                    [{index + 1}]
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800 mb-2">
                      {problem.title}
                    </p>
                    {problem.content_latex && (
                      <div className="mb-4 overflow-x-auto">
                        <MathMarkdownRenderer content={problem.content_latex} />
                      </div>
                    )}
                    {/* Answer space */}
                    <div className="mt-3 border-b border-dashed border-gray-300 pb-8">
                      <span className="text-xs text-gray-400">解答欄</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-sheet,
          #print-sheet * {
            visibility: visible;
          }
          #print-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none !important;
            border-radius: 0 !important;
            padding: 20mm !important;
          }
        }
      `}</style>
    </div>
  );
}
