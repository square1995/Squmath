# Squmath — プロジェクト構成メモ

## 概要
Squmath は数学専門のプリント作成 Web アプリです。
問題の入力・OCR 取込・LaTeX 編集・印刷プレビューをひとつのツールで提供します。

## 技術スタック

| カテゴリ | 技術 | バージョン |
|---|---|---|
| フロントエンド/バックエンド | Next.js (App Router) | ^14.2.0 |
| スタイリング | Tailwind CSS | ^3.4.0 |
| データベース/認証 | Supabase | ^2.45.0 |
| AI / OCR | Gemini API (gemini-1.5-flash) | @google/generative-ai ^0.21.0 |
| 数式表示 | KaTeX | ^0.16.11 |
| ホスティング | Vercel (GitHub Actions 経由) | — |

## ディレクトリ構成

```
squmath/
├── app/
│   ├── layout.tsx              # ルートレイアウト (KaTeX CSS import)
│   ├── page.tsx                # ランディングページ
│   ├── globals.css             # Tailwind + 印刷用スタイル
│   ├── api/
│   │   └── ocr/route.ts        # Gemini OCR API エンドポイント
│   ├── (auth)/                 # 認証ページ (ログイン/登録)
│   └── (app)/                  # 認証必須ページ
│       ├── layout.tsx          # サイドバー付きレイアウト (auth guard)
│       ├── dashboard/          # ダッシュボード
│       ├── problems/           # 問題一覧 & 作成
│       └── print/              # 印刷プレビュー
├── components/
│   ├── math/MathRenderer.tsx   # KaTeX ラッパー (Client Component)
│   └── ui/Button.tsx           # 汎用ボタン
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # ブラウザ用 (createBrowserClient)
│   │   └── server.ts           # サーバー用 (createServerClient + cookies)
│   └── gemini/
│       └── client.ts           # Gemini API クライアント + extractLatexFromImage()
├── types/index.ts              # 共有 TypeScript 型
└── .github/workflows/
    └── deploy.yml              # GitHub Actions → Vercel デプロイ
```

## 環境変数

`.env.local.example` をコピーして `.env.local` を作成してください。

| 変数名 | 説明 | 公開 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL | ✅ public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名キー | ✅ public |
| `SUPABASE_SERVICE_ROLE_KEY` | サービスロールキー（サーバーのみ） | ❌ secret |
| `GEMINI_API_KEY` | Google AI Studio API キー | ❌ secret |

## Supabase セットアップ

### テーブル定義

```sql
-- 問題テーブル
create table problems (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  content_latex text,
  subject text,
  difficulty integer check (difficulty between 1 and 5),
  created_at timestamptz default now() not null
);

-- ワークシート (プリント) テーブル
create table worksheets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text,
  created_at timestamptz default now() not null
);

-- 問題とワークシートの中間テーブル
create table worksheet_problems (
  worksheet_id uuid references worksheets(id) on delete cascade,
  problem_id uuid references problems(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (worksheet_id, problem_id)
);

-- Row Level Security
alter table problems enable row level security;
alter table worksheets enable row level security;
alter table worksheet_problems enable row level security;

-- ポリシー: 自分のデータのみ操作可能
create policy "users can manage own problems"
  on problems for all using (auth.uid() = user_id);

create policy "users can manage own worksheets"
  on worksheets for all using (auth.uid() = user_id);

create policy "users can manage own worksheet_problems"
  on worksheet_problems for all
  using (
    worksheet_id in (
      select id from worksheets where user_id = auth.uid()
    )
  );
```

### Supabase Dashboard での設定
1. [supabase.com](https://supabase.com) でプロジェクト作成
2. SQL Editor で上記 DDL を実行
3. Authentication → Email を有効化
4. プロジェクト設定から URL と API キーを取得

## Vercel デプロイ設定

### GitHub Actions secrets（リポジトリ設定で追加）

| Secret 名 | 取得場所 |
|---|---|
| `VERCEL_TOKEN` | Vercel アカウント設定 → Tokens |
| `VERCEL_ORG_ID` | `vercel link` 実行後 `.vercel/project.json` の `orgId` |
| `VERCEL_PROJECT_ID` | `vercel link` 実行後 `.vercel/project.json` の `projectId` |

### Vercel 環境変数
Vercel Dashboard → Project Settings → Environment Variables に以下を追加：
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`

## ローカル開発

```bash
# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.local.example .env.local
# .env.local を編集して実際の値を設定

# 開発サーバー起動
npm run dev
# → http://localhost:3000

# ビルド確認
npm run build
```

## KaTeX の使い方

`MathRenderer` コンポーネントを使って数式を表示します。

```tsx
import { MathRenderer } from "@/components/math/MathRenderer";

// インライン数式
<MathRenderer formula="x^2 + y^2 = r^2" />

// ディスプレイ数式（中央揃え、大きめ）
<MathRenderer formula="\int_0^\infty e^{-x} dx = 1" displayMode />
```

## Gemini OCR の使い方

`/api/ocr` エンドポイントに画像ファイルを POST すると LaTeX が返ります。

```bash
curl -X POST /api/ocr \
  -F "image=@problem.jpg"
# → { "latex": "x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}" }
```

## 認証

Google OAuth のみを使用します。メールアドレス・パスワード認証は無効にしてください。

### OAuth フロー

```
1. ユーザーが /login で「Googleでログイン」をクリック
2. supabase.auth.signInWithOAuth({ provider: 'google' }) でリダイレクト
3. Google 認証後、Supabase 経由で /auth/callback?code=... に戻る
4. Route Handler がコードをセッションと交換して /dashboard へリダイレクト
```

### Supabase 側の設定

1. Supabase Dashboard → Authentication → Providers → Google を有効化
2. Google Cloud Console でOAuth 2.0 クライアントを作成
   - 承認済みリダイレクト URI: `https://<supabase-project>.supabase.co/auth/v1/callback`
3. クライアント ID・シークレットを Supabase の Google プロバイダー設定に入力
4. Supabase Dashboard → Authentication → URL Configuration → Redirect URLs に追加:
   - `http://localhost:3000/auth/callback`（ローカル開発）
   - `https://<本番ドメイン>/auth/callback`（Vercel）

### 関連ファイル

| ファイル | 役割 |
|---|---|
| `app/(auth)/login/page.tsx` | Google ログインボタン |
| `app/auth/callback/route.ts` | OAuth コールバック（コード交換 → リダイレクト） |
| `app/(app)/layout.tsx` | 認証ガード + ログアウト（Server Action） |

## 開発フロー（ブランチ運用）

### ルール
- **開発は必ずフィーチャーブランチで行う**。`main` ブランチには直接コミットしない。
- 作業完了後、フィーチャーブランチを `main` にマージして `main` を最新に保つ。
- Vercel へのプロダクションデプロイは `main` への push で自動実行される（GitHub Actions）。

### Claude Code による開発時のブランチ命名
Claude Code が自動生成するブランチ名の形式：
```
claude/<作業内容の要約>-<ランダムID>
```

### 作業の流れ
```bash
# 1. フィーチャーブランチで開発・コミット・プッシュ
git checkout -b claude/feature-name-XXXXX
# ... 開発 ...
git add <files>
git commit -m "feat: ..."
git push -u origin claude/feature-name-XXXXX

# 2. main にマージして本番反映
git checkout main
git merge --no-ff claude/feature-name-XXXXX -m "Merge branch 'claude/feature-name-XXXXX'"
git push origin main

# 3. フィーチャーブランチの後片付け（任意）
git branch -d claude/feature-name-XXXXX
```

### ブランチ保護の推奨設定（GitHub → Settings → Branches）
- `main` ブランチに直接 push を禁止（require pull request）したい場合は Branch protection rules を設定してください。
- CI（GitHub Actions）の通過を必須にする場合は「Require status checks to pass」を有効化。
