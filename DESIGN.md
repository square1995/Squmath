# DESIGN.md — 全体設計

このドキュメントは、Squmath の**全体設計・アーキテクチャ・認証フロー・API 設計**を記録するものです。
詳細なデータ構造は `DATA.md`、コーディング規約は `CODING.md`、デプロイは `DEPLOY.md` を参照。

---

## 0. このドキュメントの位置づけ

- **対象読者**: Claude Code(主に Claude が読む)、将来この仕事を引き継ぐ人
- **書く内容**: 「なぜその設計にしたか」を含めて記録する。判断の背景が消えると後で同じ議論を繰り返すことになるため。
- **書かない内容**: 具体的なコード(`CODING.md`)、CREATE TABLE 文(`DATA.md`)、デプロイ手順(`DEPLOY.md`)

---

## 1. 全体アーキテクチャ

### 1.1 レイヤー構成

```
┌──────────────────────────────────────────────────────────────┐
│  ブラウザ(Mac/Windows、Chrome/Safari/Edge)                  │
│  ・Next.js Client Components                                  │
│  ・MathLive(数式入力)、KaTeX(表示)、GeoGebra(図形)      │
└────────────────┬─────────────────────────────────────────────┘
                 │ HTTPS
                 ▼
┌──────────────────────────────────────────────────────────────┐
│  Cloudflare Pages(本番) / Next.js dev server(ローカル)    │
│  ・Server Components(SSR)                                    │
│  ・Route Handlers(/api/*、Edge Runtime)← 業務ロジック       │
└────────────────┬─────────────────────────────────────────────┘
                 │ HTTPS(supabase-js / fetch)
                 ▼
┌──────────────────────────────────────────────────────────────┐
│  Supabase                                                     │
│  ・Auth(Google OAuth)                                        │
│  ・PostgreSQL + RLS                                            │
│  ・Storage(問題画像など)                                    │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 役割分担(最重要・絶対遵守)

| レイヤー | 責任 | やってはいけないこと |
|---|---|---|
| ブラウザ(Client Component) | 表示・ユーザー入力・MathLive 編集 | 計算・問題生成・権限判定・`owner_id` 決定 |
| Next.js サーバー(Route Handler / Server Component) | 業務ロジック・JWT 検証・Supabase への問い合わせ | DB に業務ロジックを持たせる、生 SQL の組み立てを避けず文字列連結する |
| Supabase | 保存・RLS による権限制御・Auth | 業務ロジック(複雑なトリガー、ストアド)を持つ |

→ **「ブラウザは見せるだけ」「サーバーは判定する」「DB は保存と最低限の権限制御だけ」** を原則とする。

### 1.3 データフローの典型例

例: 問題を保存する

1. ブラウザで MathLive で LaTeX 入力 → `POST /api/problems` を叩く
2. Route Handler が Supabase から JWT を検証して `auth.uid()` を取得
3. Route Handler が `owner_id = auth.uid()` を**サーバー側で**セットして INSERT
4. Supabase の RLS が `owner_id = auth.uid()` の場合のみ INSERT を許可
5. 返ってきた行をブラウザに返す

→ **`owner_id` をフロントが送ることは絶対にしない**(なりすまし防止)。

---

## 2. 認証フロー

### 2.1 採用方式: Supabase Auth + Google OAuth + `allowed_emails` 許可リスト

S-quire スタッフのみが使うため、**「Google アカウントは持っていてもログインを許可するのは特定のメアドだけ」** という運用にする。

### 2.2 フロー図

```
[未ログイン] /login にアクセス
   ↓
[「Google でログイン」ボタンを押す]
   ↓
Supabase Auth → Google OAuth の同意画面
   ↓
[ユーザーが同意]
   ↓
Google から callback URL に戻る → Supabase が JWT を発行
   ↓
[/auth/callback] で Route Handler が allowed_emails をチェック
   ├─ メアドが許可リストにない → サインアウト → /login?error=not_allowed へ
   └─ メアドが許可リストにある → users テーブルに upsert(初回のみ作成)→ /dashboard へ
```

### 2.3 ポイント

- **Supabase の `auth.users` テーブル**は Supabase が管理する(直接触らない)。
- アプリ側の **`public.users` テーブル**には `auth.users.id` を FK として持ち、`role` や `display_name` などプロファイル情報を入れる。
- **`allowed_emails` テーブル**にメアドを登録した人だけがログイン可能。
- 初回ログイン時に `public.users` 行が自動作成される(`/auth/callback` で実装)。
- **管理者(シンジさん)**は `allowed_emails` に手動で追加する(Supabase ダッシュボードの SQL Editor から `INSERT`)。

### 2.4 サインアウト後の挙動

- セッション切れ・サインアウト後に `/api/*` を叩くと 401 を返す。
- ブラウザ側でグローバル fetch ラッパーが 401 を検知 → 自動で `/login` にリダイレクト。

---

## 3. 権限モデル

### 3.1 ロール一覧

| ロール | 説明 | 権限 |
|---|---|---|
| `staff` | 通常のスタッフ | 自分のフォルダ内の問題・プリントを CRUD 可能、master データは閲覧のみ |
| `admin` | 管理者(シンジさん一人) | 全データ閲覧可能、`allowed_emails` 管理、master データの編集 |

### 3.2 権限の実装場所

| 権限の種類 | 実装場所 | 理由 |
|---|---|---|
| 「自分のデータ以外は見えない/触れない」 | **Supabase の RLS** | DB レベルで弾くのが一番確実 |
| 「staff は master を編集できないが、コピーして自分のフォルダに置けば編集可能」 | **Route Handler の業務ロジック** | RLS だけでは表現しきれない複雑な処理 |
| 「`role` のチェック」 | **Route Handler が `users.role` を読んで分岐** | RLS の関数からも参照可能だが、業務ロジックは Route Handler に集約 |

### 3.3 master データの扱い

- master データ(=共通の問題集など)は `owner_id IS NULL` で表現する。
- `staff` は master を**読めるが書けない**(RLS で表現)。
- 「master を編集したい」時は、Route Handler が**自動で自分のフォルダにコピー**を作って、それを編集させる(編集対象は常に自分のもの)。

---

## 4. 画面構成・画面遷移

### 4.1 画面一覧(Phase 1 時点)

| URL | 役割 | 認証 |
|---|---|---|
| `/login` | ログイン画面(Google OAuth ボタン) | 不要 |
| `/auth/callback` | OAuth コールバック処理(Route Handler) | — |
| `/dashboard` | ログイン後のホーム画面 | 必要 |
| `/problems` | 問題一覧 | 必要 |
| `/problems/new` | 問題新規作成 | 必要 |
| `/problems/[id]` | 問題編集 | 必要 |

Phase 2 以降で `/worksheets`、`/print/[id]` などが増える。

### 4.2 画面遷移図(Phase 1)

```
[/login]
  ↓ ログイン成功
[/dashboard] ─┬─→ [/problems] ─┬─→ [/problems/new]
              │                 └─→ [/problems/[id]]
              └─→ (将来) [/worksheets]
```

### 4.3 ナビゲーション

- ログイン後はサイドバー(または上部メニュー)で常に **問題一覧 / プリント一覧 / 設定** に遷移可能。
- ブラウザの戻るボタンで一覧画面に戻れることを保証する。
- 編集中に他画面へ遷移しようとした場合、未保存の変更があれば確認ダイアログを出す(Phase 1 後半で実装)。

---

## 5. API 設計

### 5.1 URL 体系

```
/api/problems            問題リソース
/api/problems/[id]
/api/worksheets          (Phase 3〜)
/api/folders             (Phase 2〜)
/api/tags                (Phase 2〜)
/api/admin/allowed-emails (admin 専用)
/api/auth/callback       OAuth コールバック
/api/ocr                 Gemini OCR エンドポイント
```

### 5.2 メソッド対応

| メソッド | 用途 | 例 |
|---|---|---|
| `GET /api/problems` | 一覧取得(クエリで絞り込み) | `?folder=xxx&q=keyword` |
| `GET /api/problems/[id]` | 1 件取得 | |
| `POST /api/problems` | 新規作成 | body: `{ title, content, meta }` |
| `PUT /api/problems/[id]` | 更新 | body: `{ title, content, meta }` |
| `DELETE /api/problems/[id]` | **論理削除**(`deleted_at` を立てる) | |

### 5.3 レスポンス形式

すべての Route Handler は次の形式で返す(詳細は `CODING.md`):

```json
// 成功
{ "ok": true, "data": { ... } }

// 失敗
{ "ok": false, "error": { "code": "NOT_FOUND", "message": "..." } }
```

HTTP ステータスコードは
- 200: 成功
- 400: クライアントの入力エラー(バリデーション失敗)
- 401: 未認証
- 403: 認証済みだが権限なし
- 404: リソースが存在しない
- 500: サーバーエラー(想定外)

### 5.4 認証ヘッダ

ブラウザは Supabase の Cookie で自動認証されるため、特別なヘッダは不要。
Route Handler は `createServerClient`(`@supabase/ssr`)で Cookie から JWT を読む。

---

## 6. データの拡張方針

### 6.1 コア構造は固定、拡張は JSONB

`problems` テーブルの**列(カラム)は固定**:

| カラム | 型 | 役割 |
|---|---|---|
| `id` | uuid | 主キー |
| `owner_id` | uuid | 所有者 |
| `title` | text | タイトル(検索対象) |
| `content` | jsonb | 問題本文(LaTeX、画像参照、図形定義など) |
| `meta` | jsonb | 検索用メタデータ(難易度、単元、タグ参照など) |
| `created_at` / `updated_at` / `deleted_at` | timestamptz | 監査・論理削除 |

新しい属性を増やしたいときは:

- ✅ **OK**: `content` または `meta` の中に新キーを足す(JSONB なのでスキーマ変更不要)
- ✅ **OK**: 検索が必要なら `meta` に入れて、生成カラム(`generated column`)で検索用インデックスを張る
- ❌ **NG**: `problems` に新しいカラムを追加する(コア構造を変えると影響範囲が大きい)
- ❌ **NG**: 既存カラムの意味を変える

### 6.2 JSONB の中の構造例(詳細は DATA.md)

```jsonc
// problems.content の例
{
  "kind": "math_problem",
  "version": 1,
  "body_latex": "次の方程式を解け。\\(x^2 + 2x - 3 = 0\\)",
  "answer_latex": "x = 1, -3",
  "explanation_latex": "因数分解して...",
  "images": [{ "storage_path": "problems/abc.jpg", "caption": "図1" }]
}

// problems.meta の例
{
  "subject": "math",      // 数学固定だが拡張余地のため記録
  "school_level": "high", // junior / high
  "grade": 1,             // 1〜3
  "unit": "二次方程式",
  "difficulty": 3,        // 1〜5
  "tag_ids": ["uuid-1", "uuid-2"]
}
```

### 6.3 「変更ではなく追加で対応」の意味

例: 「難易度を 5 段階 → 10 段階に変えたい」と言われたとき:

- ❌ NG: `meta.difficulty` の意味を 1〜10 に変更 → 既存データの解釈が壊れる
- ✅ OK: `meta.difficulty_v2` という新しいキーを足す。古い `difficulty` はそのまま残す
- 完全に新方式に切り替えたいタイミングで、データ移行スクリプトを書いて一斉に変換する

---

## 7. 論理削除の方針

### 7.1 ルール

- **削除は `deleted_at` カラム(timestamptz)に削除日時を入れるだけ**
- レコードを物理削除しない(`DELETE FROM ...` は使わない)
- すべての SELECT で `WHERE deleted_at IS NULL` を付ける(または View で隠す)
- **完全削除は admin が手動**で SQL Editor から実行する(誤削除リカバリのため)

### 7.2 復元

- staff には削除しか見せない(「ゴミ箱」UI は Phase 2 以降で検討)
- admin は SQL Editor から `UPDATE ... SET deleted_at = NULL WHERE id = ...` で復元可能

### 7.3 RLS との関係

- `deleted_at IS NOT NULL` のレコードは**SELECT もできない**ように RLS でフィルタする(staff には見せない)
- admin だけは `deleted_at` 付きも見られるようにする(将来の管理画面用)

---

## 8. PDF 出力アーキテクチャ(Phase 5 / Phase 6 で関係)

### 採用方針: A → C 二段構え

**Phase 5(初回実装)**: 案 A — ブラウザ標準印刷(`window.print()` + `@media print` CSS)
**Phase 6 着手前後**: 案 C — Cloudflare Browser Rendering API へ移行

### この方針を選んだ理由(2026-04-30 決定)

| 案 | Phase 5 採用? | 理由 |
|---|---|---|
| **A**(ブラウザ印刷 + `@media print`) | ✅ Phase 5 で採用 | 無料・即実装可能・KaTeX レンダリング OK・規律守れば C への移行コストが低い |
| **B**(クライアント側 PDF: html2pdf.js) | ❌ スキップ | rasterize された PDF になるため数式や GeoGebra(Phase 6)に向かない。B → C 移行は A → C より大変なので投資価値低 |
| **C**(Cloudflare Browser Rendering) | ✅ Phase 6 前後で導入 | Workers Paid プラン($5/月)が必要だが、Chromium による高品質 PDF。GeoGebra/iframe にも対応 |
| D(別 Lambda Puppeteer) | ❌ 不採用 | Cloudflare 統一方針に反する |

### A → C 移行コストの所在

A→C 移行を**半日で済ませるため**、Phase 5 から以下の規律を守る(詳細は CODING.md §印刷 CSS 規約):

1. 印刷スタイルは **`@media print` CSS のみ**(JS で DOM を弄って印刷見た目を変えない)
2. 印刷可能な画面は必ず **専用 URL**(例: `/worksheets/[id]/print`)を持つ
3. 印刷専用 URL では **クライアント遅延 fetch を使わない**(全部 Server Component で初期データ込みでレンダリング)
4. ヘッダ/フッタ/ページ番号は **CSS の `@page` ルール**で設定

これらに違反すると C 移行が数日コースになる。

### Phase 6 で C へ移行するときに必要な作業(見積もり: 半日)

1. **Cloudflare 課金**: Workers Paid プラン($5/月)有効化
2. **`wrangler.jsonc`**: Browser Rendering binding を 3 行追加
3. **新 Route Handler**: `app/api/worksheets/[id]/pdf/route.ts`(約 50 行)
   - 自身の `/worksheets/[id]/print` URL を Browser Rendering に渡して PDF バイナリを取得・返却
4. **UI**: 「印刷」ボタンの隣 or 置換で「PDF ダウンロード」ボタン追加
5. **動作確認**: A4 縦/横、複数ページ、KaTeX、GeoGebra

### コスト想定

| Phase | 月額 |
|---|---|
| Phase 5 | $0(Workers Free) |
| Phase 6 以降 | $5+ /月(Workers Paid + Browser Rendering 含み枠) |

Browser Rendering の含み枠を超える利用(月 10 分以上のブラウザ起動)が見込まれた時点で再評価する。

---

## 9. このドキュメントの更新タイミング

以下の場合は必ずこのファイルを更新する:

- 新しい画面・API エンドポイントを追加した
- 認証フロー・権限モデルを変更した
- アーキテクチャ(レイヤー構成)を変更した
- 新しい外部サービスと連携した
- 「設計判断」が発生した(例: 「○○を A にするか B にするかを A に決めた、その理由は…」)

更新したら CLAUDE.md §9 のルールに従って Claude Code が自動で報告する。
