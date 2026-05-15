# CODING.md — コーディング規約

このドキュメントは、Squmath のコードを書くときの**命名規則・ファイル構成・API レスポンス形式・Edge Runtime での注意点**をまとめたものです。
Claude Code が新しいコードを書くときに読む。設計の背景は `DESIGN.md`、データは `DATA.md`、デプロイは `DEPLOY.md`。

---

## 0. このドキュメントの位置づけ

- ここに書かれたルールに沿ってコードを書く。
- 既存コードに**新しいルールを後付け適用**する場合は、別作業として段階的に行う(分割と修正は別作業の原則)。
- ルールが現実と合わなくなったら、まずこのファイルを更新してから直す。

---

## 1. ディレクトリ構成(着手時に作成)

```
squmath/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # ルートレイアウト(html lang="ja"・KaTeX CSS 読み込み)
│   ├── page.tsx                  # ランディング(未ログインなら /login へ)
│   ├── globals.css               # Tailwind + 印刷用スタイル
│   ├── (auth)/                   # 認証関連ページのグループ
│   │   ├── login/page.tsx
│   │   └── auth/callback/route.ts  # OAuth コールバック (Route Handler)
│   ├── (app)/                    # 認証必須のページグループ
│   │   ├── layout.tsx            # サイドバー + auth guard
│   │   ├── dashboard/page.tsx
│   │   └── problems/
│   │       ├── page.tsx          # 一覧
│   │       ├── new/page.tsx      # 新規作成
│   │       └── [id]/page.tsx     # 編集
│   └── api/                      # Route Handlers (Edge Runtime)
│       ├── problems/
│       │   ├── route.ts          # GET (一覧) / POST (新規)
│       │   └── [id]/route.ts     # GET (1件) / PUT (更新) / DELETE (論理削除)
│       └── ocr/route.ts          # Gemini OCR
├── components/
│   ├── math/MathRenderer.tsx     # KaTeX ラッパー (Client Component)
│   ├── math/MathInput.tsx        # MathLive ラッパー (Phase 4)
│   └── ui/Button.tsx             # 汎用ボタンなど
├── lib/
│   ├── constants.ts              # ★ アプリ全体の定数(ルート・テーブル名等)を一元管理
│   ├── supabase/
│   │   ├── client.ts             # ブラウザ用 (createBrowserClient)
│   │   ├── server.ts             # サーバー用 (createServerClient + cookies)
│   │   └── service.ts            # service_role 用 (Route Handler の中だけ)
│   ├── auth/guard.ts             # 認証チェックヘルパ
│   ├── api/response.ts           # API レスポンス形式の組み立て
│   └── gemini/client.ts          # Gemini クライアント
├── types/
│   ├── domain.ts                 # ドメイン型 (Problem, User など)
│   └── api.ts                    # API 入出力の型
├── DEPLOY.md / DESIGN.md / DATA.md / CODING.md / CLAUDE.md
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── next.config.mjs
└── .env.local.example
```

---

## 2. ファイル・ディレクトリ命名規則

| 対象 | 規則 | 例 |
|---|---|---|
| ファイル名(コード) | **kebab-case** | `math-renderer.tsx` … と書きたいところだが Next.js は `MathRenderer.tsx` のような **PascalCase** も許容 |
| **コンポーネントファイル** | **PascalCase**(慣習) | `MathRenderer.tsx`, `Button.tsx` |
| **ユーティリティ・モジュール** | **kebab-case** または **camelCase** | `lib/supabase/server.ts`, `lib/api/response.ts` |
| **Next.js 規約ファイル** | Next.js が指定 | `page.tsx`, `layout.tsx`, `route.ts`, `loading.tsx`, `error.tsx` |
| ディレクトリ名 | **kebab-case** | `math/`, `ui/`, `api/problems/` |
| 環境変数 | **UPPER_SNAKE_CASE** | `NEXT_PUBLIC_SUPABASE_URL`, `GEMINI_API_KEY` |

迷ったら **「Next.js のドキュメントの書き方に合わせる」** を優先する。

---

## 3. TypeScript の型定義

### 3.1 場所

- **ドメイン型**(`Problem`, `User` など、DB と対応する型): `types/domain.ts`
- **API 入出力型**(`CreateProblemBody`, `ProblemResponse` など): `types/api.ts`
- **コンポーネント固有の型**: そのコンポーネントのファイル内に書く

### 3.2 ドメイン型のテンプレート

```ts
// types/domain.ts

// problems.content の型(JSONB)
export type ProblemContent = {
  kind: "math_problem";
  version: number;
  body_latex?: string;
  answer_latex?: string;
  explanation_latex?: string;
  images?: { storage_path: string; caption?: string }[];
  geogebra?: unknown; // Phase 6 で正式化
};

// problems.meta の型(JSONB)
export type ProblemMeta = {
  subject?: "math";
  school_level?: "junior" | "high";
  grade?: 1 | 2 | 3;
  unit?: string;
  difficulty?: 1 | 2 | 3 | 4 | 5;
  tag_ids?: string[];
  source?: string;
};

// problems テーブルの行
export type Problem = {
  id: string;
  owner_id: string | null;
  title: string;
  content: ProblemContent;
  meta: ProblemMeta;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // 生成カラムは select で取れるが、書き込み時には触らない
  subject: string | null;
  school_level: string | null;
  grade: number | null;
  unit: string | null;
  difficulty: number | null;
};
```

### 3.3 ルール

- **`any` は使わない**(`unknown` でとりあえず受けて型ガードする)。
- **オプショナル(`?`)** は積極的に使う(JSONB のキーは欠けることがある前提)。

### 3.4 Supabase の型自動生成(2026-04-29 導入)

DB スキーマと TypeScript 型のズレを防ぐため、`types/supabase.ts` は **GitHub Actions が Supabase 本体から自動生成**する仕組みを導入済み。

- **ワークフロー**: `.github/workflows/sync-supabase-types.yml`
- **トリガー**:
  - 毎日 00:00 UTC(日本時間 09:00)に自動実行
  - GitHub の Actions タブから手動実行(スキーマ変更直後はこちらで即時反映)
- **動作**:
  1. Supabase CLI で `types/supabase.ts` を再生成
  2. 差分があれば `claude/sync-types-<timestamp>` ブランチに自動コミット
  3. `merge-to-main.yml` が main へ自動マージ
  4. Cloudflare Workers Builds が再ビルドしてアプリに反映
- **必要な GitHub Secrets**: `SUPABASE_PROJECT_REF` / `SUPABASE_ACCESS_TOKEN`(設定済み)

#### `types/domain.ts` との関係

- `types/supabase.ts`: **自動生成・手で触らない**。テーブル全カラムの完全な型(生成カラム含む)
- `types/domain.ts`: **手書き**。`supabase.ts` をベースに、JSONB の `content` / `meta` の構造を絞り込んだ実用型を定義する場所

```ts
// types/domain.ts(将来形)
import type { Database } from "./supabase";

// supabase.ts の自動生成型をベースに、JSONB 部分だけ絞る
export type Problem = Omit<
  Database["public"]["Tables"]["problems"]["Row"],
  "content" | "meta"
> & {
  content: ProblemContent;
  meta: ProblemMeta;
};
```

#### ローカルで手動生成したいとき

```bash
export SUPABASE_PROJECT_REF=xxxxx     # Supabase の Reference ID
export SUPABASE_ACCESS_TOKEN=sbp_...  # ローカル用のアクセストークン
npm run gen:types
```

`SUPABASE_ACCESS_TOKEN` は `.env.local` には書かない(他の env と衝突するため)。シェル環境変数として一時的に設定する。

#### NEVER

- ❌ `types/supabase.ts` を手で編集する(自動生成で上書きされる)
- ❌ `types/domain.ts` で DB 直接の型を再定義する(必ず `supabase.ts` を import して派生させる)

---

## 4. API レスポンス形式

すべての Route Handler は次の形式を返す。

### 4.1 成功

```ts
// HTTP 200
{
  "ok": true,
  "data": <T>
}
```

### 4.2 失敗

```ts
// HTTP 400 / 401 / 403 / 404 / 500
{
  "ok": false,
  "error": {
    "code": "NOT_FOUND" | "UNAUTHORIZED" | "FORBIDDEN" | "VALIDATION" | "INTERNAL",
    "message": "ユーザー向けの分かりやすいメッセージ"
  }
}
```

### 4.3 ヘルパ(`lib/api/response.ts`)

```ts
// lib/api/response.ts

type ApiOk<T> = { ok: true; data: T };
type ApiErr = { ok: false; error: { code: string; message: string } };

export function ok<T>(data: T, status = 200): Response {
  const body: ApiOk<T> = { ok: true, data };
  return Response.json(body, { status });
}

export function err(
  code: string,
  message: string,
  status = 400
): Response {
  const body: ApiErr = { ok: false, error: { code, message } };
  return Response.json(body, { status });
}
```

### 4.4 HTTP ステータスコード対応

| ステータス | code 値 | 用途 |
|---|---|---|
| 200 | — | 成功 |
| 400 | `VALIDATION` | バリデーション失敗(入力エラー) |
| 401 | `UNAUTHORIZED` | 未ログイン |
| 403 | `FORBIDDEN` | ログイン済みだが権限なし |
| 404 | `NOT_FOUND` | リソースが存在しない |
| 500 | `INTERNAL` | サーバー内部エラー(想定外) |

---

## 5. Route Handler のテンプレート

### 5.1 必ず Edge Runtime を指定

```ts
// app/api/problems/route.ts
export const runtime = "edge";  // ← Cloudflare Pages で動かすために必須
```

### 5.2 認証ガード

```ts
// lib/auth/guard.ts
import { createServerSupabase } from "@/lib/supabase/server";
import { err } from "@/lib/api/response";

export async function requireUser() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { user: null, response: err("UNAUTHORIZED", "ログインが必要です", 401) };
  }
  return { user, response: null };
}
```

### 5.3 完全版テンプレート(POST 新規作成)

```ts
// app/api/problems/route.ts
import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guard";
import { ok, err } from "@/lib/api/response";

export const runtime = "edge";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.title !== "string" || body.title.trim() === "") {
    return err("VALIDATION", "タイトルを入力してください", 400);
  }

  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("problems")
    .insert({
      owner_id: auth.user.id,            // ★ サーバー側で必ずセット(フロントから受け取らない)
      title: body.title,
      content: body.content ?? {},
      meta: body.meta ?? {},
    })
    .select()
    .single();

  if (error) {
    return err("INTERNAL", "保存に失敗しました", 500);
  }

  return ok(data, 200);
}
```

### 5.4 ルール

- `owner_id` は **必ず Route Handler 内で `auth.user.id` をセット**する。フロントから受け取らない。
- 入力は最低限のバリデーション(必須項目チェック・型チェック)。複雑な検証は今は深追いしない(必要になったら Zod 等の導入を検討)。
- `error` の中身を**そのままレスポンスに出さない**(内部情報が漏れる)。ユーザー向けメッセージに変換する。

---

## 6. Edge Runtime での注意点

Cloudflare Pages では Route Handler が **Edge Runtime**(Node.js 互換ではない)で動く。

### 6.1 使えるもの

- `fetch`, `Request`, `Response`, `URL`, `URLSearchParams` などの Web 標準 API
- `crypto.randomUUID()` などの Web Crypto API
- `@supabase/supabase-js`, `@supabase/ssr`(Edge 対応済み)
- `@google/generative-ai`(fetch ベース、Edge OK)

### 6.2 使えないもの(主なもの)

| 機能 | 代替 |
|---|---|
| `fs`(ファイルシステム) | Supabase Storage を使う |
| `child_process` | 使えない(処理を分割するか、別 Workers にする) |
| Node 専用 npm パッケージ(`bcrypt`, `puppeteer` 等) | Edge 対応版を探すか、別の方法に切り替え |
| `process.env.XXX` の動的アクセス | Cloudflare Pages では `globalThis.process.env` 経由で読める。`@cloudflare/next-on-pages` が変換してくれる |

迷ったら **「ライブラリ名 + edge runtime」で検索**する。

### 6.3 環境変数の参照

```ts
// OK(ビルド時に静的に解決される)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;

// NG(動的アクセスは Edge で制限あり、ものによる)
const key = process.env[someDynamicName];
```

---

## 7. エラーハンドリング

### 7.1 Route Handler

- 成功は `ok(...)`、失敗は `err(...)` を返す(§4 のヘルパ使用)。
- `try/catch` は **外部 API 呼び出し** や **想定外の例外を包むため** にだけ使う。普通のフロー制御に使わない。
- ログは `console.error(...)` で十分(Cloudflare のダッシュボードで見られる)。

```ts
try {
  const result = await callGeminiOcr(image);
  return ok(result);
} catch (e) {
  console.error("[ocr] gemini call failed", e);
  return err("INTERNAL", "OCR に失敗しました。時間をおいて再度お試しください", 500);
}
```

### 7.2 ブラウザ側

- API 呼び出しは **共通の fetch ラッパ** を使う(`lib/api/client.ts` を作る)。
- 401 が返ったら自動で `/login` へリダイレクト。
- それ以外のエラーは **トースト表示** などで「○○に失敗しました(再試行できます)」を出す。

### 7.3 ユーザー向けメッセージのトーン

- ❌ NG: 「Internal Server Error」「Unauthorized」「500」
- ✅ OK: 「保存に失敗しました。少し時間をおいてもう一度お試しください」「ログインが必要です」

### 7.4 グローバルエラーページ(2026-04-30 導入)

予期せぬ例外を Next.js のデフォルト「Application error」画面で見せると、利用者にとって何の手がかりにもならないので、**専用のエラーページ**を用意している。

| ファイル | 役割 |
|---|---|
| `app/error.tsx` | アプリ内で発生した一般的な例外(Server Component / Route Handler 由来含む) |
| `app/global-error.tsx` | RootLayout 自体が壊れた時の最終フォールバック(`<html>` `<body>` を自前で書く必要あり) |
| `app/not-found.tsx` | 404 の優しい画面 |

#### 表示すべき要素

- 何が起きたかの平易な説明(技術用語禁止)
- 利用者が次に取れるアクション(「再読み込み」「ダッシュボードへ」)
- **エラー ID(Next.js が付ける `digest`)** を表示 → 管理者問い合わせ時の手がかり
- 連絡先(管理者: シンジさん)への誘導

#### NEVER

- ❌ エラー画面で技術スタックトレースを見せる(社内とはいえ利用者は混乱する)
- ❌ エラー画面で「リロードしないでください」のような選択肢のない指示
- ❌ `error.tsx` 内で副作用(API 呼び出し等)を起こす(無限ループの危険)

### 7.5 ログのコンテキスト規約

`console.error` は必ず**コンテキスト情報を頭に付ける**。Cloudflare Logs(Observability)で grep しやすくするため。

```ts
// ✅ Good
console.error("[GET /api/problems] db error", error);
console.error("[auth/callback] users upsert failed", upsertError);

// ❌ Bad(後で何の処理か分からない)
console.error(error);
console.error("failed");
```

### 7.6 削除・破壊的操作の確認

データの**削除・送信・公開**など取り返しのつかない操作は **二段階確認**を必ず入れる。

```ts
// 最低限の例
if (!window.confirm("本当に削除しますか?(取り消しできません)")) return;
await fetch(`/api/problems/${id}`, { method: "DELETE" });
```

将来的にはモーダル UI に置き換える(Phase 3 以降の検討事項)。

---

## 8. UI 実装の方針

### 8.1 スタイリング: Tailwind CSS

- インラインクラスで書く(別ファイルの CSS には基本書かない)。
- **印刷用スタイル**は `globals.css` に `@media print { ... }` でまとめる。
- 共通コンポーネント(Button, Input, Modal など)は `components/ui/` に置く。

### 8.2 数式表示: KaTeX

```tsx
// components/math/MathRenderer.tsx (Client Component)
"use client";
import katex from "katex";
import "katex/dist/katex.min.css";

export function MathRenderer({ formula, displayMode = false }: { formula: string; displayMode?: boolean }) {
  const html = katex.renderToString(formula, { displayMode, throwOnError: false });
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
```

KaTeX の CSS は `app/layout.tsx` で**全体読み込み**しておく(欠落するとフォントが崩れる)。

### 8.3 数式入力: MathLive(Phase 4)

- Client Component として `mathlive` の `<math-field>` をラップする。
- 出力は LaTeX 文字列として `problems.content.body_latex` に保存。
- ライブラリの読み込み・型は Phase 4 着手時にここへ追記。

### 8.4 図形: GeoGebra(Phase 6)

- iframe で埋め込み or 公式 npm パッケージを使用。
- Phase 6 着手時にこのセクションを更新。

### 8.5 Mac/Windows 両対応(CLAUDE.md §12 参照)

- **`<html lang="ja">` を `app/layout.tsx` で必ず指定**(macOS Safari の中国語フォント化を防ぐ)。
- フォント指定は `tailwind.config.ts` の `theme.extend.fontFamily.sans` で:

  ```ts
  // tailwind.config.ts(抜粋)
  export default {
    theme: {
      extend: {
        fontFamily: {
          sans: [
            "-apple-system",
            "BlinkMacSystemFont",
            '"Hiragino Sans"',
            '"Hiragino Kaku Gothic ProN"',
            '"Yu Gothic"',
            '"Meiryo"',
            "sans-serif",
          ],
        },
      },
    },
  };
  ```

- ファイルは **UTF-8(BOM なし)** で保存する。

---

## 8.6 定数の一元管理: `lib/constants.ts`(2026-05-15 導入)

アプリ名・ページルート・API ルート・DB テーブル名など、**複数ファイルで使い回す値は必ず `lib/constants.ts` に書く**。文字列を直接コードに書くと、変更時に何十カ所も直す必要が生じる(2026-05-15 に問題が発覚し、一括整理した)。

### 現在の `lib/constants.ts` の内容

```ts
import type { ProblemListSort } from "@/types/api";

// アプリ表示名
export const APP_NAME = "Squmath";

// ページルート
export const ROUTES = {
  LOGIN: "/login",
  DASHBOARD: "/dashboard",
  PROBLEMS: "/problems",
  PROBLEMS_NEW: "/problems/new",
  ADMIN_USERS: "/admin/users",
} as const;

// API ルート
export const API = {
  PROBLEMS: "/api/problems",
  ADMIN_IMPERSONATIONS: "/api/admin/impersonations",
  ME_IMPERSONATION: "/api/me/impersonation",
} as const;

// DB テーブル名
export const TABLE = {
  USERS: "users",
  PROBLEMS: "problems",
  IMPERSONATIONS: "impersonations",
  ALLOWED_EMAILS: "allowed_emails",
} as const;

// 問題一覧の並び順定義(API・画面の両方で共有)
export const SORT_MAP = { ... } as const;

// ページネーション
export const PAGINATION = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 100,
} as const;
```

### 使い方

```ts
// ✅ 正しい使い方
import { TABLE, ROUTES, API, APP_NAME } from "@/lib/constants";

supabase.from(TABLE.PROBLEMS).select("*");
redirect(ROUTES.LOGIN);
fetch(API.PROBLEMS, { method: "POST" });
<h1>{APP_NAME}</h1>
```

```ts
// ❌ 直接書いてはいけない
supabase.from("problems").select("*");
redirect("/login");
fetch("/api/problems", { method: "POST" });
<h1>Squmath</h1>
```

### 新しい定数を追加するとき

**新しいページ・API エンドポイント・DB テーブル**を作ったら、コードと同時に `lib/constants.ts` を必ず更新する。

| 追加したもの | `lib/constants.ts` に追加するもの |
|---|---|
| 新しいページ(`app/(app)/foo/page.tsx`) | `ROUTES.FOO = "/foo"` |
| 新しい API(`app/api/foo/route.ts`) | `API.FOO = "/api/foo"` |
| 新しい DB テーブル | `TABLE.FOO = "foo"` |
| アプリ全体で共通の数値や文字列 | 適切なグループの定数として追加 |

### NEVER(定数管理の禁止事項)

- ❌ ページの URL パスを文字列リテラルで直接 `href="/problems"` のように書く
- ❌ API の URL を文字列リテラルで直接 `fetch("/api/problems")` のように書く
- ❌ DB テーブル名を文字列リテラルで直接 `.from("problems")` のように書く
- ❌ アプリ名「Squmath」を直接 JSX に書く
- ❌ 同じ定数値を複数ファイルで別々に定義する(必ず `lib/constants.ts` から `import` する)

---

## 9. import の整理ルール

```ts
// 1. React / Next.js
import { useState } from "react";
import Link from "next/link";

// 2. 外部ライブラリ
import katex from "katex";

// 3. プロジェクト内のエイリアス(@/) — lib → components → types の順
import { TABLE, ROUTES } from "@/lib/constants";          // ← 定数は最初に
import { createServerSupabase } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import type { Problem } from "@/types/domain";

// 4. 相対パス
import "./local.css";
```

`tsconfig.json` の `paths` で `@/*` を `./` にマップしておく(Next.js のデフォルト)。

---

## 9.5 Supabase スキーマ変更のワークフロー(2026-04-29 導入)

DB スキーマの変更は **必ず `supabase/migrations/` に migration ファイルを追加して CI 経由で本番適用**する。Supabase ダッシュボードの SQL Editor で直接変更してはいけない(Git 管理下から外れて再現性が失われる)。

### 標準ワークフロー

1. Claude が `supabase/migrations/<タイムスタンプ>_<内容>.sql` を新規作成
   - タイムスタンプ書式: `YYYYMMDDHHMMSS`(例: `20260501120000_add_tags_table.sql`)
2. Claude がチャットで SQL の全文をシンジさんに提示
3. シンジさんが OK を出してから `claude/**` ブランチに push
4. main マージ後、`apply-migrations.yml` が自動で `supabase db push` を実行
5. 続けて `sync-supabase-types.yml` がトリガーされ `types/supabase.ts` 更新
6. 必要なら `types/domain.ts` を修正(Claude が型エラー駆動で対応)

### migration ファイルの書き方

- **冪等性を意識**: `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ADD COLUMN IF NOT EXISTS` 等、再実行しても壊れない書き方を優先
- **トランザクションは `supabase db push` が自動で囲む**ので明示の `BEGIN; COMMIT;` は不要
- **コメントで意図を残す**: ファイル冒頭に「何を・なぜ追加したか」を 1 行コメント
- **RLS ポリシーも同じ migration 内で定義**(テーブル追加と権限設定は分離しない)

### 緊急の修正

すでに当てた migration に間違いがあった場合:

- ❌ そのファイルを書き換えない(履歴破壊)
- ✅ 新しい migration ファイル(`<timestamp>_fix_xxx.sql`)で「打ち消し」「修正」を別途追加

### 例

```sql
-- supabase/migrations/20260501120000_add_tags_table.sql
-- Phase 2: タグ機能の追加。問題に複数タグを付けられるようにする。

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists tags_name_unique on public.tags (name);

alter table public.tags enable row level security;

create policy "tags_select_authenticated"
  on public.tags for select
  to authenticated
  using (true);
```

詳細は [supabase/README.md](../supabase/README.md) を参照。

---

## 10. 印刷 CSS / PDF 出力規約(2026-04-30 導入)

Squmath は数学プリントを **A4 用紙に印刷 / PDF 化**して使う前提のアプリ。**印刷品質**と、Phase 6 での **Cloudflare Browser Rendering(C 案)への移行コスト最小化**のため、以下の規約を厳守する。

### 10.1 印刷スタイルは `@media print` CSS のみで実装する

JS で DOM を弄って印刷見た目を変えてはいけない。

- ✅ `<button class="no-print">` のように **クラスで宣言的に**「印刷で消す」を表す
- ❌ `useEffect(() => { document.querySelector(...).style.display = "none" }, [])` のような JS 操作

**理由**: Phase 6 で Cloudflare Browser Rendering(C 案)に移行すると、サーバ側で印刷 URL を Chromium が開くだけ。JS の動作タイミングがズレてレイアウトが崩れる。CSS だけで決まっていれば崩れない。

### 10.2 印刷可能な画面は専用 URL を持つ

- ✅ `/worksheets/[id]/print` のような**印刷専用ページ**を必ず用意
- ❌ 通常画面のモーダルに HTML を描画して `window.print()`

**理由**: C 案では URL を Chromium に渡して PDF を生成する。専用 URL が無いと、PDF 生成側が「どの画面を撮ればよいか」を指定できない。

### 10.3 印刷専用ページは Server Component で初期データ完備

- ✅ Server Component で `await supabase.from(...)` 等を済ませて、HTML 完成形でレスポンス
- ❌ Client Component で `useEffect(() => fetch(...), [])` で後からデータを取りに行く

**理由**: C 案の Chromium はページを開いて少し待つだけで PDF を撮る。クライアント遅延 fetch のデータが間に合わず、空の PDF が出る。

### 10.4 ヘッダ・フッタ・ページ番号は `@page` CSS ルールで設定

- ✅ `@page { size: A4; margin: 15mm; @bottom-center { content: counter(page); } }` のようなネイティブ CSS
- ❌ React で「右下にページ番号を絶対配置」する自前実装

**理由**: ブラウザ印刷の `@page` は確実に動く。自前実装は段組や複数ページに弱い。

### 10.5 印刷時に表示を変える要素は CSS の `display:none` で隠す

- ✅ `<aside class="no-print">サイドバー</aside>`(`globals.css` の `@media print` で `display: none`)
- ❌ `<aside style={{ display: isPrinting ? 'none' : 'block' }}>` のような React state 切替

**理由**: C 案では React の state 変化はサーバ側 SSR の状態でしか反映されない。CSS で隠せば確実。

### 10.6 印刷専用ページのレイアウト分離(任意・推奨)

可能なら印刷ページは `app/(print)/...` のようなルートグループに分け、通常 UI のレイアウト(サイドバー等)を継承しない。

- ✅ `app/(print)/worksheets/[id]/print/page.tsx` + `app/(print)/layout.tsx`(プリント用最小レイアウト)
- 普通の `app/(app)/...` の認証必須レイアウトの外に置く

**理由**: C 案で URL を直接叩く時、通常レイアウトのサイドバーやヘッダが入っていると印刷時に邪魔。最初から分離しておけば見た目調整も楽。

### 10.7 共通の印刷 CSS は `app/globals.css` に集約

- `@page` ルール
- `.no-print` / `.page-break-before` / `.page-break-after` / `.page-break-avoid` 等のユーティリティクラス
- 印刷時の `body` スタイル(背景白・文字色黒・基本フォントサイズ 10.5pt)

→ ページ毎に重複定義しない。**雛形は globals.css に既に入っている**(2026-04-30)。

### 10.8 NEVER(印刷関連の禁止事項)

- ❌ JavaScript で印刷時の DOM を書き換える(規約 11.1)
- ❌ 印刷可能なものをモーダル / 専用 URL なしで実装する(規約 11.2)
- ❌ 印刷専用ページで `useEffect` / `useState` 等のクライアント遅延処理を使う(規約 11.3)
- ❌ ピクセル単位の絶対配置で印刷レイアウトを組む(プリンタ・PDF 変換で崩れる、`mm` / `pt` を使う)
- ❌ 印刷時の見た目をブラウザの DevTools で「都度確認」だけで済ませる(必ず実 PDF を出す)

### 10.9 動作確認の流れ

印刷 / PDF 出力の変更時は、以下を確認:

1. 画面で **Ctrl+P / Cmd+P** → プレビューでレイアウト確認
2. **A4 縦・横の両方**で崩れないか
3. 「PDF として保存」で実 PDF を出してファイル開いて確認
4. Phase 6 で C 案に移行したら、本番 URL で **PDF ダウンロードボタン**で同じ確認

---

## 10.5 OpenNext / Next.js のキャッシュ戦略(2026-04-30 暫定)

### 現状: キャッシュなし(`open-next.config.ts` は空)

```ts
// open-next.config.ts
export default defineCloudflareConfig({});
```

これにより:
- すべての Server Component が**毎回フル SSR**(常に最新データ)
- `fetch` のデフォルトキャッシュも無効
- 利用者が「保存したのに反映されない」混乱を起こさない

### Squmath では当面これで OK

- 利用者数が少ない(社内 1〜数人)→ パフォーマンス影響軽微
- データ更新頻度が高い(問題作成・編集が日常)→ 古いキャッシュは混乱の元
- 課金(Workers CPU 時間)も低利用なら無料枠内に収まる

### Phase 3(プリント作成)以降で必要になったら検討

問題が数千〜数万件になり、一覧表示や検索の SSR が遅くなった時点で:

| 対策 | 内容 | 注意点 |
|---|---|---|
| **R2 incremental cache** | OpenNext 公式の incremental cache を R2 に置く | バケット作成・bindings 設定が必要 |
| **revalidate を局所的に有効化** | 「めったに変わらない」ページだけ `revalidate = 60` 等 | データ整合性のテストが必要 |
| **Server Component の手動メモ化** | `unstable_cache` でキー指定キャッシュ | キー設計を間違えると古いデータが残る |

導入時は **CODING.md / DESIGN.md / BUGS.md を更新**すること。

### NEVER(キャッシュ関連の禁止事項)

- ❌ 「とりあえずキャッシュ入れとく」(意図不明な事前最適化)
- ❌ ユーザー固有データ(`user.id` 依存のもの)を共有キャッシュに入れる(漏洩・誤表示の危険)
- ❌ 削除済み(`deleted_at IS NOT NULL`)の問題を含むキャッシュをそのまま返す

---

## 11. このドキュメントの更新タイミング

以下の場合は必ずこのファイルを更新する:

- 新しい命名規則・ディレクトリ規則を決めた
- API レスポンス形式を変更した
- Edge Runtime で踏んだ罠を共有したい(BUGS.md と併用)
- 新しい外部ライブラリ(MathLive、GeoGebra など)の使い方を確定した

更新したら CLAUDE.md §9 のルールに従って Claude Code が自動で報告する。
