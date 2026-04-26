# Squmath

数研出版「Studyaid D.B.」相当のプリント作成 Web アプリ。S-quire とは独立した別プロジェクト。

## プロジェクト概要

- **目的**: 数学プリント作成アプリ（Studyaid D.B. の機能を Web 上で再現）
- **対象**: 数学のみ（中学数学・高校数学）
- **利用者**: S-quire スタッフ（管理者: シンジさん一人）
- **公開範囲**: 社内ツール（Google アカウント認証で許可された人のみ）

## モジュール化されたドキュメント

詳細は以下のファイルを参照:

- [DESIGN.md](./DESIGN.md) - 全体設計、テーブル構成、権限モデル、API 設計
- [DATA.md](./DATA.md) - データ構造の詳細、JSONB スキーマ、CREATE TABLE 文
- [DEPLOY.md](./DEPLOY.md) - デプロイ手順、環境構築、Cloudflare / Supabase 設定
- [CODING.md](./CODING.md) - コーディング規約、命名規則、API レスポンス形式
- [LATEX_GUIDELINES.md](./LATEX_GUIDELINES.md) - LaTeX 記法ガイドライン

## 技術スタック

- **フロント**: Cloudflare Pages
- **バックエンド**: Cloudflare Workers
- **DB**: Supabase (PostgreSQL + RLS)
- **認証**: Supabase Auth + Google OAuth
- **ストレージ**: Supabase Storage
- **数式表示**: KaTeX
- **数式入力**: MathLive
- **図形・グラフ**: GeoGebra

## 開発フェーズ

| Phase | 内容 |
|---|---|
| Phase 1 | 認証 + users + 基本問題 CRUD |
| Phase 2 | 検索・絞り込み（生成カラム、タグ、フォルダ） |
| Phase 3 | プリント作成（worksheets + blocks） |
| Phase 4 | 数式エディタ（MathLive）統合 |
| Phase 5 | PDF 出力（出力モード切替対応） |
| Phase 6 | 図形（GeoGebra）統合 |
| Phase 7 | 対応表検索、自動作問、その他拡張 |

## 設計方針（最重要・絶対遵守）

- コア構造は固定
- 拡張は `content` / `meta`（JSONB）で行う
- 変更ではなく追加で対応する
- フロントは計算・問題生成・権限制御をしない
- DB は保存と RLS のみ、業務ロジックは持たない
- `owner_id` はフロントから送らず、Workers が JWT から取得
- 削除は論理削除のみ、完全削除は admin が手動

## NEVER（やってはいけないこと）

- フロントエンドで `owner_id` を決めて送信する
- `meta.tags` の配列で運用する（`tags` テーブルへ正規化済み）
- `worksheet_items` を作る（`worksheet_blocks` に統合済み）
- master データを staff が直接編集する処理を書く（自動コピー必須）
- DB に業務ロジックを実装する（RLS は権限制御のみ）
- 既存カラムの型や意味を変更する（必ず新規追加で対応）
- 教科を増やす（数学専用、理科その他は対象外）

## 関連リポジトリ

- `square1995/S-quire` - 塾管理アプリ（別プロジェクト、参考のみ）
- `square1995/englishtest` - 英単語テストアプリ（別プロジェクト、参考のみ）
