# DEPLOY.md — デプロイ・環境構築手順

このドキュメントは、Squmath をローカルで動かすための初期セットアップと、Cloudflare Workers へのデプロイ手順をまとめたものです。
**プログラミング初心者向け**に書いているので、コマンドはそのままコピペすれば動きます。

> 📝 **2026-04-29 更新**: Cloudflare Pages + `@cloudflare/next-on-pages` から、Cloudflare Workers + `@opennextjs/cloudflare`(OpenNext アダプター)へ移行しました。旧アダプターは deprecated となり、Next.js のバージョン制約による脆弱性(CVE-2025-66478 など)を受けやすかったため。

---

## 全体像

```
[ローカル開発]
  Next.js (App Router) ← Route Handlers (Node.js ランタイム)
    ↓
  Supabase (Auth + DB + Storage) ← ローカルからは直接接続

[本番デプロイ]
  GitHub (main ブランチ)
    ↓ Cloudflare Workers Builds の GitHub 連携で自動トリガー
  Cloudflare 側ビルダー
    ↓ @opennextjs/cloudflare でビルド(.open-next/worker.js を生成)
  Cloudflare Workers + Static Assets にデプロイ
    ↓
  本番ドメイン(例: https://squmath.<account>.workers.dev もしくはカスタムドメイン)

  ※ GitHub Actions の deploy.yml は TypeScript 型チェック専用。本番デプロイ自体には関与しない。
```

---

## 0. 必要なアカウント

事前に以下のアカウントを作成しておきます(すべて無料):

| サービス | 用途 | URL |
|---|---|---|
| GitHub | ソース管理 | https://github.com |
| Cloudflare | ホスティング(Workers) | https://dash.cloudflare.com |
| Supabase | DB + 認証 + ストレージ | https://supabase.com |
| Google Cloud Console | Google OAuth クライアント発行 | https://console.cloud.google.com |
| Google AI Studio | Gemini API キー(OCR 用) | https://aistudio.google.com |

---

## 1. ローカル開発環境のセットアップ

### 1.1 必要ソフト

- **Node.js 20 以上**: https://nodejs.org からインストール(LTS 版で OK)
- **Git**: 通常は OS に同梱
- **VS Code**(推奨エディタ): https://code.visualstudio.com

### 1.2 リポジトリのクローン

```bash
git clone https://github.com/square1995/Squmath.git
cd Squmath
```

### 1.3 依存パッケージのインストール

```bash
npm install
```

### 1.4 環境変数ファイルの作成

```bash
cp .env.local.example .env.local
```

その後、`.env.local` を編集して**実際の値**を入れます(値の取得方法は §3〜§4 参照)。

### 1.5 開発サーバー起動

```bash
npm run dev
```

→ ブラウザで http://localhost:3000 を開く

---

## 2. Supabase プロジェクトの作成

### 2.1 プロジェクト作成

1. https://supabase.com にログイン
2. **`New project`** をクリック
3. 設定:
   - **Name**: `squmath`(自由)
   - **Database Password**: 強いパスワードを設定(後で使うのでメモ)
   - **Region**: `Northeast Asia (Tokyo)` を推奨(日本から最速)
   - **Pricing Plan**: Free
4. プロジェクト作成完了まで 2 分ほど待つ

### 2.2 API キーの取得

プロジェクトを開き、左メニュー **`Settings → API`** を開く:

| 項目 | 取得する値 | 用途 | 公開可否 |
|---|---|---|---|
| Project URL | `https://xxxxx.supabase.co` | `NEXT_PUBLIC_SUPABASE_URL` | ✅ 公開 OK |
| Project API keys → `anon` `public` | 長い文字列 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ 公開 OK |
| Project API keys → `service_role` `secret` | 長い文字列 | `SUPABASE_SERVICE_ROLE_KEY` | ❌ **絶対に公開しない** |

これらを `.env.local` に記入。

### 2.3 Google OAuth の設定

#### 2.3.1 Google Cloud Console 側

1. https://console.cloud.google.com で新規プロジェクト作成(名前: `Squmath` 等)
2. 左メニュー **`APIs & Services → OAuth consent screen`**
   - User Type: External
   - App name: `Squmath`
   - User support email: 自分のメアド
   - Authorized domains: `supabase.co`
   - スコープ: `email`, `profile`, `openid` を追加
3. 左メニュー **`Credentials → Create Credentials → OAuth client ID`**
   - Application type: Web application
   - Authorized redirect URIs:
     - `https://xxxxx.supabase.co/auth/v1/callback` (Supabase の URL に合わせる)
4. 発行された **Client ID** と **Client Secret** をメモ

#### 2.3.2 Supabase 側

1. Supabase ダッシュボードで **`Authentication → Providers`**
2. **Google** を有効化
3. Google Cloud で取得した **Client ID** と **Client Secret** を貼り付け
4. **Save**

### 2.4 テーブル定義の実行

Supabase ダッシュボード **`SQL Editor`** で、`DATA.md` に記載の CREATE TABLE 文と RLS ポリシーを実行する。

(具体的な SQL は **DATA.md** を参照)

---

## 3. Gemini API キーの取得(OCR 用)

1. https://aistudio.google.com にログイン
2. **`Get API key`** をクリック
3. 発行された API キーを `.env.local` の `GEMINI_API_KEY` に記入

---

## 4. `.env.local` の最終形

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJI...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJI...

# Gemini
GEMINI_API_KEY=AIzaSy...
```

⚠️ **`.env.local` は絶対にコミットしない**(`.gitignore` で除外済み)。

---

## 5. Cloudflare Workers にデプロイ

### 5.1 Cloudflare アカウントの準備

1. https://dash.cloudflare.com にログイン
2. 右上のアカウントアイコン → **`My Profile → API Tokens`**(必要なら API トークンを発行 — Workers Builds の GitHub 連携を使うなら通常は不要)
3. Cloudflare ダッシュボード右サイドバーの **Account ID** をメモしておく

### 5.2 Cloudflare Workers プロジェクトの作成(Workers Builds 経由)

1. Cloudflare ダッシュボード左メニュー **`Workers & Pages → Create → Workers → Import a repository`**(または **`Connect to Git`**)
2. GitHub の `square1995/Squmath` を選択して権限を許可
3. プロジェクト名: `squmath`(`wrangler.jsonc` の `name` と一致させる)
4. プロダクションブランチ: `main`
5. ビルド設定:
   - **Framework preset**: `Next.js`(自動検出される)
   - **Build command**: `npm ci && npm run build && npx opennextjs-cloudflare build`
     - 先頭の `npm ci` は明示で **npm を強制**するため(`package.json` の `packageManager` フィールドと合わせて二重に固定)。これがないと Cloudflare 環境が bun を勝手に使うことがある
   - **Deploy command**: `npx wrangler deploy`
   - **Root directory**: `/`(空欄)
6. 環境変数(Production):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`(Secret として登録)
   - `GEMINI_API_KEY`(Secret として登録)
   - `NODE_VERSION` = `20`
7. **`Save and Deploy`**

> 💡 ビルド/デプロイコマンドの詳細はプロジェクトの `package.json` の `deploy` スクリプトを参照。
> Cloudflare Workers Builds はリポジトリ直下の `wrangler.jsonc` を自動で読み、`compatibility_flags` の `nodejs_compat` を有効化してくれる。

### 5.3 デプロイの確認

- 初回ビルドが完了すると `https://squmath.<account>.workers.dev` で本番が見られる(URL は Workers のプロジェクトページに表示される)
- `main` ブランチに push されるたびに、Cloudflare Workers Builds が自動で再デプロイする

### 5.4 (任意)カスタムドメインの設定

独自ドメインを使いたい場合:

1. Cloudflare Workers のプロジェクトページ **`Settings → Domains & Routes → Add → Custom Domain`**
2. ドメイン名を入力(例: `squmath.example.com`)
3. Cloudflare 上で DNS を管理しているドメインなら、Cloudflare が自動で CNAME を設定する

---

## 6. GitHub Actions の自動マージ設定

### 6.1 すでに導入済み

- `.github/workflows/merge-to-main.yml` が `claude/**` への push をトリガーに自動で main にマージする
- `.github/workflows/deploy.yml` は **TypeScript の型チェック専用**(`npm run typecheck` を実行する)。本番デプロイは Cloudflare Workers Builds の GitHub 連携で別途実行される。

### 6.2 (任意)`AUTO_MERGE_TOKEN` の設定

自動マージ後に Cloudflare Workers のデプロイも完全自動化したい場合は、Personal Access Token を `AUTO_MERGE_TOKEN` として登録:

1. GitHub の Settings → Developer settings → Personal access tokens → Tokens (classic)
2. **`Generate new token (classic)`**
3. スコープ: `repo` 全部 + `workflow`
4. 発行されたトークンをコピー
5. リポジトリの **Settings → Secrets and variables → Actions** で **`AUTO_MERGE_TOKEN`** として登録

これを設定すると、自動マージ後の `main` への push が「人間が push した」と見なされ、Cloudflare Workers Builds の自動デプロイが走るようになる。

---

## 7. トラブルシューティング

### `npm install` でエラーが出る

- Node.js のバージョンを確認: `node -v` → `v20.x` 以上であること
- `node_modules` を消してやり直し: `rm -rf node_modules package-lock.json && npm install`

### `npm run dev` でログイン後にエラー

- `.env.local` の値が間違っている可能性
- Supabase Auth の Provider 設定で Google が有効になっているか確認
- Google OAuth の Authorized redirect URI が `https://xxxxx.supabase.co/auth/v1/callback` になっているか確認

### Cloudflare Workers のビルドが失敗する

- ビルドコマンドが `npm run build && npx opennextjs-cloudflare build` になっているか確認
- 環境変数(Production)がすべて設定されているか確認(Secret 種別と通常変数の使い分けに注意)
- `wrangler.jsonc` の `compatibility_flags` に `nodejs_compat` が入っているか確認
- ローカルで `npm run preview` を実行して同じビルドエラーが出るか確認すると原因切り分けが早い

### Supabase に接続できない

- ブラウザの Network タブで Supabase の URL に接続できているか確認
- Supabase の Free プランは長期間使わないと一時停止することがある(ダッシュボードで Resume)

---

## 8. このドキュメントの更新タイミング

以下の場合は必ずこのファイルを更新する:

- 新しい環境変数を追加した
- ビルドコマンドや出力ディレクトリを変えた
- デプロイ先・サービスを変更した
- 新しい外部サービス(API)と連携した

更新したら CLAUDE.md の §9「md ファイル自動育成ルール」に従って、Claude Code が自動で報告する。
