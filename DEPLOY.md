# DEPLOY.md — デプロイ・環境構築手順

このドキュメントは、Squmath をローカルで動かすための初期セットアップと、Cloudflare Pages へのデプロイ手順をまとめたものです。
**プログラミング初心者向け**に書いているので、コマンドはそのままコピペすれば動きます。

---

## 全体像

```
[ローカル開発]
  Next.js (App Router) ← Route Handlers (Edge Runtime)
    ↓
  Supabase (Auth + DB + Storage) ← ローカルからは直接接続

[本番デプロイ]
  GitHub (main ブランチ)
    ↓ push で自動トリガー
  GitHub Actions (deploy.yml)
    ↓ @cloudflare/next-on-pages でビルド
  Cloudflare Pages にデプロイ
    ↓
  本番ドメイン(例: https://squmath.pages.dev)
```

---

## 0. 必要なアカウント

事前に以下のアカウントを作成しておきます(すべて無料):

| サービス | 用途 | URL |
|---|---|---|
| GitHub | ソース管理 | https://github.com |
| Cloudflare | ホスティング(Pages) | https://dash.cloudflare.com |
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

## 5. Cloudflare Pages にデプロイ

### 5.1 Cloudflare アカウントと API トークンの準備

1. https://dash.cloudflare.com にログイン
2. 右上のアカウントアイコン → **`My Profile → API Tokens`**
3. **`Create Token`** をクリック
4. テンプレート: **`Edit Cloudflare Workers`** を選択(または Custom token で `Account: Cloudflare Pages: Edit` を付与)
5. 発行されたトークンをメモ → GitHub リポジトリの secrets に **`CLOUDFLARE_API_TOKEN`** として登録
6. Cloudflare ダッシュボード右サイドバーの **Account ID** をメモ → GitHub secrets に **`CLOUDFLARE_ACCOUNT_ID`** として登録

### 5.2 Cloudflare Pages プロジェクトの作成

1. Cloudflare ダッシュボード左メニュー **`Workers & Pages → Create application → Pages → Connect to Git`**
2. GitHub の `square1995/Squmath` を選択
3. プロジェクト名: `squmath`
4. プロダクションブランチ: `main`
5. ビルド設定:
   - **Framework preset**: `Next.js`
   - **Build command**: `npx @cloudflare/next-on-pages@latest`
   - **Build output directory**: `.vercel/output/static`
6. 環境変数(Production):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`
   - `NODE_VERSION` = `20`
7. **`Save and Deploy`**

### 5.3 デプロイの確認

- 初回ビルドが完了すると `https://squmath.pages.dev` で本番が見られる
- `main` ブランチに push されるたびに、Cloudflare Pages が自動で再デプロイする

### 5.4 (任意)カスタムドメインの設定

独自ドメインを使いたい場合:

1. Cloudflare Pages のプロジェクトページ **`Custom domains → Set up a custom domain`**
2. ドメイン名を入力(例: `squmath.example.com`)
3. DNS の指示に従って CNAME を設定

---

## 6. GitHub Actions の自動マージ設定

### 6.1 すでに導入済み

- `.github/workflows/merge-to-main.yml` が `claude/**` への push をトリガーに自動で main にマージする
- `.github/workflows/deploy.yml` は Cloudflare Pages に直接デプロイするものではなく、(必要に応じて)テスト・型チェックを行う用途に使う想定

### 6.2 (任意)`AUTO_MERGE_TOKEN` の設定

自動マージ後に Cloudflare Pages のデプロイも完全自動化したい場合は、Personal Access Token を `AUTO_MERGE_TOKEN` として登録:

1. GitHub の Settings → Developer settings → Personal access tokens → Tokens (classic)
2. **`Generate new token (classic)`**
3. スコープ: `repo` 全部 + `workflow`
4. 発行されたトークンをコピー
5. リポジトリの **Settings → Secrets and variables → Actions** で **`AUTO_MERGE_TOKEN`** として登録

これを設定すると、自動マージ後の `main` への push が「人間が push した」と見なされ、Cloudflare Pages の自動デプロイが走るようになる。

---

## 7. トラブルシューティング

### `npm install` でエラーが出る

- Node.js のバージョンを確認: `node -v` → `v20.x` 以上であること
- `node_modules` を消してやり直し: `rm -rf node_modules package-lock.json && npm install`

### `npm run dev` でログイン後にエラー

- `.env.local` の値が間違っている可能性
- Supabase Auth の Provider 設定で Google が有効になっているか確認
- Google OAuth の Authorized redirect URI が `https://xxxxx.supabase.co/auth/v1/callback` になっているか確認

### Cloudflare Pages のビルドが失敗する

- ビルドコマンドが `npx @cloudflare/next-on-pages@latest` になっているか確認
- 環境変数がすべて設定されているか確認
- Edge Runtime 非対応のライブラリを使っていないか確認(Node.js 専用パッケージは使えない)

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
