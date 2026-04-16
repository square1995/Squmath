import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-50 to-white">
      <div className="max-w-5xl mx-auto px-4 py-16">
        {/* Header */}
        <header className="flex items-center justify-between mb-16">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-primary-700">Squmath</span>
            <span className="text-sm text-gray-500 ml-1">β</span>
          </div>
          <nav className="flex gap-4">
            <Link
              href="/login"
              className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
            >
              Googleでログイン
            </Link>
          </nav>
        </header>

        {/* Hero */}
        <section className="text-center py-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
            数学プリントを
            <span className="text-primary-600"> AIで </span>
            かんたん作成
          </h1>
          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
            問題の入力・OCR取込・LaTeX編集・印刷まで、すべてひとつのツールで。
            KaTeXによる美しい数式表示で、プロ品質のプリントを。
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/login"
              className="bg-primary-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-primary-700 transition-colors shadow-lg"
            >
              Googleでログイン
            </Link>
            <Link
              href="/dashboard"
              className="border-2 border-primary-600 text-primary-600 px-8 py-4 rounded-xl text-lg font-semibold hover:bg-primary-50 transition-colors"
            >
              ダッシュボードへ
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
          {[
            {
              icon: "✏️",
              title: "LaTeX対応エディタ",
              description:
                "KaTeXを使ったリアルタイムプレビューで、美しい数式を素早く入力できます。",
            },
            {
              icon: "📸",
              title: "AI OCR取込",
              description:
                "Gemini AIが画像から数式を自動認識。手書き問題もデジタル化できます。",
            },
            {
              icon: "🖨️",
              title: "印刷最適化",
              description:
                "A4/B4対応の印刷レイアウト。問題番号・配点・解答欄を自動配置します。",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
            >
              <div className="text-3xl mb-3">{feature.icon}</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </section>

        {/* Footer */}
        <footer className="text-center mt-20 text-gray-400 text-sm">
          <p>© 2025 Squmath. Built with Next.js, Supabase, Gemini & KaTeX.</p>
        </footer>
      </div>
    </main>
  );
}
