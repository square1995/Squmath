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
- **DB の型生成**(将来):Supabase CLI で `npx supabase gen types typescript --project-id xxxx > types/supabase.ts` を生成して `types/domain.ts` の素材にする(Phase 1 後半で導入可)。

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

## 9. import の整理ルール

```ts
// 1. React / Next.js
import { useState } from "react";
import Link from "next/link";

// 2. 外部ライブラリ
import katex from "katex";

// 3. プロジェクト内のエイリアス(@/) — lib → components → types の順
import { createServerSupabase } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import type { Problem } from "@/types/domain";

// 4. 相対パス
import "./local.css";
```

`tsconfig.json` の `paths` で `@/*` を `./` にマップしておく(Next.js のデフォルト)。

---

## 10. このドキュメントの更新タイミング

以下の場合は必ずこのファイルを更新する:

- 新しい命名規則・ディレクトリ規則を決めた
- API レスポンス形式を変更した
- Edge Runtime で踏んだ罠を共有したい(BUGS.md と併用)
- 新しい外部ライブラリ(MathLive、GeoGebra など)の使い方を確定した

更新したら CLAUDE.md §9 のルールに従って Claude Code が自動で報告する。
