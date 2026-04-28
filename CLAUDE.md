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
    ├── deploy.yml              # GitHub Actions → Vercel デプロイ
    └── merge-to-main.yml       # claude/** ブランチを main に自動マージ
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

---

# Claude Code 運用ルール

ここから下は、Claude Code がこのプロジェクトで作業する際の**振る舞いルール**です。
ユーザーはプログラミング初心者であり、Claude 主導で開発を進める前提で書かれています。
プロジェクトと一緒に育てていくドキュメントなので、必要に応じて Claude が自動で追記・更新していきます。

## 0. ユーザーについて

- プログラミング初心者であり、コードの詳細は分からない
- 常に日本語で対応する
- 必要に応じて、操作手順や用語の意味を簡潔に説明する

## 1. 出力ルール

- 修正が必要な関数のみ「完全版」で提供する(部分的な抜粋は不可)
- 新規の関数を提案する場合は、ファイル内のどこに入れるかを明示する
- 処理の詳しい説明は、ユーザーから聞かれるまで不要
- コピペ用のコマンドや指示は、必ずコードブロック(```で囲む)で出力する
- 完了後は「何を変えたか」をユーザーへの影響中心に箇条書きで報告する

## 2. デプロイ・Git 操作のルール

- **開発は必ず `claude/<作業内容>-<ID>` ブランチで行う**。`main` への直接コミット・直接 push は禁止。
- `claude/**` ブランチへ push すると、GitHub Actions(`.github/workflows/merge-to-main.yml`)が**自動で `main` にマージ**する。
- `main` への push をトリガーに `.github/workflows/deploy.yml` が走り、**Vercel に本番デプロイ**される。
- 通常の修正作業では、`claude/**` への push までは確認なしで自動的に行ってよい(その後の main へのマージは Actions が処理する)。
- ただし、以下の場合は必ず実行前にユーザーに確認を取る:
  - 強制プッシュ(force push)を行う場合
  - ブランチを削除する場合
  - 既存ファイル全体を大幅に書き換える場合
  - デプロイ設定(`deploy.yml` / `merge-to-main.yml` / Vercel 設定 / 環境変数)を変更する場合
  - データベース構造(Supabase スキーマ)やデータの変更
- コミットメッセージは日本語で簡潔に書く。

### 自動マージワークフローの補足

- 既定の `GITHUB_TOKEN` で `main` に push するため、**そのままでは `deploy.yml` が再トリガーされない**仕様(GitHub の仕様で、自動 push は別ワークフローを発火しない)。
- デプロイも完全自動にしたい場合は、Personal Access Token を `AUTO_MERGE_TOKEN` という名前で Repository secrets に登録する。`merge-to-main.yml` はそれを優先的に使う。
- 設定方法が分からない場合は Claude に「AUTO_MERGE_TOKEN の作り方を教えて」と聞いてください。

## 3. 確認が必要なケース

作業前にユーザーに確認すること:

- 要求が曖昧で複数の実装方法がある
- 既存の動作を変更する可能性がある
- データの削除・リセットを伴う
- 大きな修正となる場合は、コードを書く前に必ずプランを提示し、承認を得てから実施する

確認不要で自動実行: コードのバグ修正・git バックアップ・md ファイルの更新

## 4. 大きな変更前の自動バックアップ

以下の作業前は確認なしに git コミットを作成する:
新機能追加・既存機能の大幅修正・関数の削除リネーム・ファイル構造変更・複数ファイルにまたがる変更

```
作業前バックアップ: [作業内容]
```

不要なケース: コメントのみの変更・md ファイルのみの更新・軽微な誤字修正

## 5. 不具合発生時の対応

何か壊れた・動かなくなった場合は、以下の順で対応する:

1. **直前のコミットを特定する** — `git log --oneline -10`
2. **該当ファイルを元に戻す** — `git show <コミットID>:<ファイル名>` で旧内容を確認し、戻す
3. **修正コミットをプッシュ** — 「リバート: ○○」のメッセージでコミット(`claude/**` ブランチで)
4. **原因を特定してから再実装** — 同じ方法で再実装せず、原因を確認してから慎重に再挑戦

⚠️ `git reset --hard` や `git push --force` はデータ消失のリスクがあるため、ユーザーの明示的な許可なく実行しない。

## 6. 新機能追加の原則

| 原則 | 内容 |
|---|---|
| 既存コードに触れない | 既存の関数・処理は書き換えず、新しい関数・ファイルとして追加する |
| 呼び出し箇所を最小に | 既存コードへの接続は「呼び出しを追加するだけ」に留める |
| 段階的に実装 | 大きな機能は小さなステップに分けて 1 つずつ実装・確認する |
| 独立して動作させる | 新機能が壊れても既存機能に影響しない設計を選ぶ |

## 7. プッシュ前チェックリスト

コードをプッシュする前に、以下を必ず確認する:

- [ ] `git fetch origin && git merge origin/main` で最新の main を取り込んだか
- [ ] 既存の機能を壊していないか(変更していないファイルは触っていないか)
- [ ] 修正スコープは要求された箇所だけに限定されているか
- [ ] 大きな変更の場合、ユーザーのプラン承認を得ているか
- [ ] データの削除・スキーマ変更を伴う場合、ユーザーに確認したか
- [ ] 関連する .md ファイルの更新が必要な場合、更新したか
- [ ] `npm run build` が通るか(TypeScript エラー・ビルドエラーがないか)

## 8. ファイル分割の自動判断ルール

長すぎるファイルはコンテキスト消費(Claude Code の処理コスト)とメンテナンス性の両方で問題になる。
ファイルが大きくなってきたら、Claude Code は自動でユーザーに分割を提案する。

### 分割を検討する目安

| ファイル種別 | 提案する目安 | 即分割を強く推奨する目安 |
|---|---|---|
| TypeScript / TSX (React コンポーネント含む) | 400 行 | 800 行 |
| API Route / Server 処理 | 300 行 | 600 行 |
| CSS / Tailwind 設定 | 800 行 | 1500 行 |
| Markdown | 500 行 | 1000 行 |

これはあくまで目安。**機能的なまとまり**を優先する。

### 分割の原則

- **機能単位で分ける**: 行数で機械的に分けず、関連する関数・コンポーネントをまとめる
- **共通定数は 1 ファイルに集約**: 各ファイルで重複定義しない
- **ファイル名は内容を表すものに**: 開いた瞬間に内容が分かる名前
- **分割後は FUNCTIONS.md に各ファイルの役割を記録**(ファイルが増えてきたら作成)

### CLAUDE.md 自体の分割

CLAUDE.md は **500 行を超えてきたら分割を提案**する。

| ファイル | 役割 |
|---|---|
| CLAUDE.md | 中核ルール・自動読み込み対象 |
| DEPLOY.md | デプロイ手順・自動化設定の詳細 |
| CODING.md | コーディング規約の詳細 |
| DATA.md | データ構造・環境変数の詳細 |
| DESIGN.md | 設計判断の記録 |
| BUGS.md | 既知のバグと対処法 |
| FUNCTIONS.md | 全関数の一覧 |

分割時は、CLAUDE.md に「詳細は ○○.md 参照」と参照リンクを残す。

### NEVER(分割関連の禁止事項)

- ❌ 機能の途中で機械的に分割する(同じ機能が複数ファイルに散らばる)
- ❌ 分割しただけで FUNCTIONS.md を更新しない
- ❌ 分割時に既存の関数の中身を変更する(分割と修正は別作業)
- ❌ 共通定数を各ファイルで重複定義する

## 9. md ファイル自動育成ルール

このプロジェクトのドキュメントは **Claude Code が自動で育てていく**。
以下のタイミングで、確認なしに該当の md ファイルを更新または新規作成する。

### CLAUDE.md(このファイル)を更新するタイミング

| トリガー | 更新箇所 |
|---|---|
| 本番運用が開始された | 冒頭に「🚨 本番運用中(YYYY-MM-DD〜)」の警告を追加し、変更ルールを厳格化 |
| ファイル構成が変わった | 「ディレクトリ構成」セクションを更新 |
| 技術スタックを変更した | 「技術スタック」セクションを更新 |
| 環境変数を追加した | 「環境変数」セクションを更新 |
| 重要な制約・注意点が判明した | 「既知の制約・注意点」セクションに追記(なければ作成) |

### 別の md ファイルを新規作成・更新するタイミング

| トリガー | ファイル | 内容 |
|---|---|---|
| バグを踏んで修正した | BUGS.md | 「何が起きたか」「原因」「対処法」を記録 |
| 重要な設計判断をした | DESIGN.md | 「なぜその設計にしたか」の背景込みで記録 |
| 環境変数・設定値を追加した | DATA.md | `.env.local` / Vercel 環境変数 / Supabase スキーマ等 |
| 関数・コンポーネントが増えてきた(目安: 10 個以上) | FUNCTIONS.md | 各関数・コンポーネントの役割を一覧化 |
| デプロイ設定が複雑になった | DEPLOY.md | デプロイ手順・自動化の設定を集約 |

### 育成ルールの大原則

- **追記する際は「背景」も書く**: 将来の自分や他の人が読んだときに「なぜこのルールができたか」が理解できるようにする
- **コードと .md の内容に差異が生じたら自動で更新**: トリガー外でも、内容が古くなっていたら更新する
- **更新後は必ず報告**: 「○○.md を更新しました(理由: △△)」と一言報告する

## 10. 報告文ルール

| 変更ファイル | 報告文 |
|---|---|
| アプリ本体のコード(`.ts` `.tsx` `.css` 等) | 「GitHub にプッシュしました。`claude/**` から main への自動マージ後、Vercel に反映されます(目安 2〜3 分)。」 |
| `.md` ファイルのみ | 「GitHub にプッシュしました。今回はアプリの再デプロイは発生しませんが、変更は自動で main に取り込まれます。」 |
| `deploy.yml` / `merge-to-main.yml` などの設定変更 | 「設定変更をプッシュしました。次回の push から新しい設定が有効になります。」 |

`AUTO_MERGE_TOKEN` を未設定のうちは「main への自動マージ後、**Vercel への自動デプロイは走らないため、手動で再デプロイトリガーが必要な場合があります**」と注記する。

## 11. 動作確認の依頼ルール

コードを変更してデプロイした後、Claude Code は必ずユーザーに**具体的な動作確認手順**を案内する。
ユーザーは「何を確認すべきか」を自分で判断できないため、以下のフォーマットで明示する。

```
✅ 動作確認のお願い

以下の手順で確認してください:

1. [具体的な操作1] (例: ダッシュボードを開いて「新規問題」をクリック)
2. [具体的な操作2] (例: タイトルと LaTeX を入力して「保存」をクリック)
3. [想定される結果] (例: 一覧に追加された問題が表示される)

うまくいかない場合は、以下を教えてください:
- エラーメッセージが表示されたか(あればそのままコピー)
- どの手順で止まったか
- 画面のスクリーンショット(可能なら)
```

### 動作確認の粒度

| 変更の種類 | 確認手順の詳しさ |
|---|---|
| 小さな修正(文言・色・配置) | 1〜2 ステップで簡潔に |
| 機能追加・ロジック変更 | 3〜5 ステップで具体的に |
| データ操作を伴う変更 | 確認手順 + データの確認方法も案内 |
| 印刷プレビュー関連 | ブラウザの「印刷プレビュー」でレイアウトが崩れないかも確認 |
| デプロイ設定の変更 | デプロイ完了の確認方法 + 動作確認 |

### 確認後の対応

- ユーザーが「OK」と返答 → 必要なら BUGS.md / DESIGN.md に「動作確認済み」のメモを追加
- ユーザーが「動かない」と返答 → §5 不具合発生時の対応に従う

## 12. PC ブラウザ対応・文字化け対策

このアプリは**パソコンでの利用を前提**(スマホ対応はスコープ外)。
ただし **macOS と Windows の両方**で正常に動作することを必ず意識する。
特に **macOS Safari は文字化けやフォント崩れが起きやすい**ため要注意。

### 必ず守るルール

#### HTML / メタ情報

- ルートレイアウト(`app/layout.tsx`)で **`<html lang="ja">`** を必ず指定する。
  - これがないと macOS Safari が「英語ページ」と誤認識し、日本語が中国語フォントで表示されることがある(漢字の形が微妙に違う)。
- HTML の文字コードは **UTF-8(BOM なし)** に統一する。
- 数式表示には **KaTeX の CSS** を `app/layout.tsx` で読み込む(欠落するとフォントがフォールバックして崩れる)。

#### フォント指定

- 日本語フォントは **必ず複数のフォールバックを並べる**。macOS でヒラギノ系を最優先にすること:

  ```css
  font-family:
    -apple-system,                       /* macOS / iOS Safari */
    BlinkMacSystemFont,                  /* macOS Chrome */
    "Hiragino Sans",                     /* macOS 日本語 */
    "Hiragino Kaku Gothic ProN",
    "Yu Gothic",                         /* Windows 日本語 */
    "Meiryo",
    sans-serif;
  ```

- Tailwind を使う場合は `tailwind.config.ts` の `theme.fontFamily.sans` でこのスタックを定義する。

#### 機種依存文字・特殊文字

- **㈱・①・㍿・㌍ などの機種依存文字は使わない**(代わりに「(株)」「(1)」「カロリー」と書く)。
- 数式は LaTeX(KaTeX)で表現する。生のユニコード数学記号(√, ∫, ∑ など)は OS によって表示差が出るため避ける。

#### ファイルの保存形式

- ソースコード(`.ts` `.tsx` `.css` `.md`)は **UTF-8(BOM なし)** で保存する。
- GitHub 上で文字化けしている場合、ファイルが UTF-8 以外で保存されている可能性が高い。

### ブラウザ動作確認の必須項目

修正後は、以下の最低 2 つで確認を依頼する:

1. **macOS Safari**(または最新の Chrome on macOS)— 文字化け・フォント崩れがないか
2. **Windows Chrome**(または Edge)— レイアウト・印刷プレビューが崩れないか

印刷プレビュー機能を変更したときは、**A4 縦・横の両方**で印刷プレビュー画面を確認してもらう。

### NEVER(文字化け関連の禁止事項)

- ❌ `<html lang="ja">` を省略する
- ❌ `font-family: "Yu Gothic"` のように Windows 用フォントだけを指定する(macOS で化ける)
- ❌ 機種依存文字をソースコード・UI に直接書く
- ❌ ファイルを Shift_JIS / EUC-JP で保存する

## 13. 実利用者の視点(利用者からの指摘パターン)

このアプリは**IT に不慣れな先生・利用者も使う**想定。
開発者の視点では気づきにくい問題が、実利用者から指摘されることが多い。
新機能・UI 修正の前に、以下を必ずセルフチェックする。

### 視認性

- 文字は最低 14px 以上(印刷物のサイズ感に合わせる)
- 重要なボタン(保存・印刷など)は画面のどこにあるか一目で分かるか
- 色だけで情報を伝えていないか(色覚多様性への配慮)
- 印刷時に薄いグレーが消えていないか

### 操作性

- ボタンを押した時に「押された」フィードバック(色変化・処理中表示)があるか
- 処理中に「処理中です」の表示があるか(無反応に見えると連打される)
- 間違えて押した時に「キャンセル」できるか
- ダブルタップや長押しなど、特殊操作を必須にしていないか

### 分かりやすさ

- 専門用語を避けているか(「コミット」「デプロイ」「キャッシュ」などは利用者には不要)
- エラーメッセージは具体的に何をすればいいか書いているか
- 必須項目と任意項目が見分けられるか
- 各画面に「これは何をする画面か」が明示されているか
- 戻り方・終わらせ方が分かるか(行き止まりにならない)

### 動作の安定性

- 通信が遅い時にどうなるか(タイムアウト・ローディング表示)
- 同じボタンを連続で押された時に二重実行されないか
- ブラウザの「戻る」ボタンを押した時に意図通り動くか
- ページ更新(リロード)しても入力中のデータが消えないか
- 通信エラー時に「やり直す」手段があるか

### データ入力時の配慮

- 入力ミスをした時に、最初からやり直しにならないか
- 必須項目が未入力でも、入力済み項目は保持されるか
- 確認画面で内容を見直せるか(特に削除・送信の前)
- 取り返しのつかない操作(削除など)は二段階確認するか

### 過去の指摘パターン(実例から育てる)

実利用者から指摘を受けた内容を、ここに追記していく。
日付・指摘内容・対応策をセットで記録することで、同じ指摘を二度と受けない仕組みを作る。

(例)YYYY-MM-DD: 「文字が小さくて読めない」→ 全体のフォントサイズを 14px → 16px に変更

(以下、運用しながら追記していく)

## 14. 自動化・改善提案

作業完了後、自動化できる余地や使い勝手の改善点があれば以下の形式で提案する:

```
💡 自動化の提案 / 📱 使い勝手の改善案
・現状: 〜
・改善案: 〜
・メリット: 〜
やってみますか?
```

## 15. NEVER(過去のトラブルから学んだ禁止事項)

- 強制プッシュ(force push)はユーザーの確認なしに絶対に行わない
- ユーザーの確認なしに本番データ(Supabase 上のデータ)を変更しない
- 動作確認できる範囲のものは、確認してからデプロイする
- 既存の機能を予告なく削除しない(変更ではなく「削除」が問題)
- 同じエラーで 2 回以上ループした場合、勝手に試行錯誤せずユーザーに状況を報告する
- 大規模なリファクタリング・コードの一括整理は、要求されない限り行わない
- `main` ブランチに直接コミット・直接 push しない(必ず `claude/**` 経由)

このセクションは**プロジェクト固有の禁止事項が見つかったら追記していく**。
過去に踏んだ罠を記録しておくことで、同じ失敗を繰り返さない。

## 16. トラブル時の対応

- エラーが出た場合は、勝手に推測せず、エラーメッセージをそのまま報告する
- 修正案が複数考えられる場合は、選択肢を提示してユーザーに選んでもらう
- 同じ症状で 2 回直しても解決しない場合、原因調査に切り替える(「もう一度試す」を繰り返さない)
