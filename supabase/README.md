# supabase/ — Supabase スキーマ管理

このディレクトリは、Supabase の **DB スキーマを Git で管理**するためのものです。
Squmath はローカル開発を行わないため、すべての適用は **GitHub Actions(CI)経由**で行います。

## ファイル構成

```
supabase/
├── README.md                # このファイル
├── .gitignore               # ローカル一時ファイルを除外
└── migrations/
    └── XXXXXXXXXXXXXX_<名前>.sql   # 各 migration(タイムスタンプ + 内容名)
```

## 運用ルール

### 新しい migration を追加するとき(Claude が実行)

1. `supabase/migrations/<タイムスタンプ>_<内容>.sql` を新規作成
   - タイムスタンプは `YYYYMMDDHHMMSS` 形式(例: `20260501120000_add_tags_table.sql`)
2. SQL の中身を書く(CREATE TABLE / ALTER / RLS ポリシー追加 等)
3. 必ずチャットで SQL 全文をシンジさんに見せて承認を得る
4. 承認後 `claude/**` ブランチにコミット & push
5. main マージ後、`apply-migrations.yml` ワークフローが自動で本番に適用
6. 続けて `sync-supabase-types.yml` がトリガーされ、型が更新される

### 絶対にやってはいけないこと

- ❌ 既存 migration ファイルを編集する(履歴が壊れる)
- ❌ Supabase ダッシュボードの SQL Editor から直接スキーマを変更する(Git と本番が乖離する)
- ❌ migration ファイルを `claude/**` ブランチで「コミットだけして push しない」(本番に適用されないまま型だけ進む)

### 緊急時に SQL Editor で直接スキーマを触ってしまったら

その場合、本番 DB と Git の migration が乖離します。復旧手順:

1. GitHub Actions の **Bootstrap Supabase Migrations** を再実行(同じ要領で `supabase db pull`)
2. 生成された差分 migration ファイルを承認 → コミット
3. `apply-migrations.yml` は何もしない(repair で applied 状態になっているため)

## ワークフロー

| ファイル | トリガー | 役割 |
|---|---|---|
| `.github/workflows/bootstrap-migrations.yml` | 手動(workflow_dispatch) | 既存スキーマを baseline migration として取り込む(初回 1 回) |
| `.github/workflows/apply-migrations.yml` | main の `supabase/migrations/**` 変更時 | 本番に migration を `supabase db push` で適用 |
| `.github/workflows/sync-supabase-types.yml` | 毎日 + 手動 + apply-migrations 後 | TypeScript 型を再生成 |

## 必要な GitHub Secrets

- `SUPABASE_PROJECT_REF` — Supabase プロジェクトの Reference ID
- `SUPABASE_ACCESS_TOKEN` — Supabase 個人アクセストークン
- `SUPABASE_DB_PASSWORD` — DB パスワード(`supabase db push` / `pull` が使う)
- `AUTO_MERGE_TOKEN` — bootstrap が `claude/**` ブランチへ push するため
