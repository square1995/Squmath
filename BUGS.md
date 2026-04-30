# BUGS.md — 既知のバグ・踏んだ罠の記録

このファイルは、**Squmath 開発中に踏んだバグや「なるほど」な仕様の落とし穴**を時系列で記録するものです。
将来「同じ症状に遭遇した時」「なぜこんな仕組みにしたんだっけ?」を即解決するためのメモ。

> ルール:
> - **新しいバグを踏んだら必ず追記**(発生日付・症状・原因・対処)
> - 解決後も削除しない(再発時の手がかりになる)
> - 「実はバグじゃなくて仕様だった」もここに記録 OK

---

## 2026-04-29 〜 04-30: OpenNext 移行で踏んだバグ群

### B-001 Cloudflare Workers の Build 変数と Runtime 変数を取り違えた

**症状**: Cloudflare Workers にデプロイした Next.js アプリが起動直後に
`Application error: a server-side exception has occurred` で落ちた。
ログには `Error: Your project's URL and Key are required to create a Supabase client!` が出ていた。

**原因**: `NEXT_PUBLIC_*` 変数を Cloudflare ダッシュボードの **Runtime variables** にしか登録していなかった。
`NEXT_PUBLIC_*` は Next.js が **ビルド時にバンドルへインライン**するため、ビルド時に値が取得できないと
バンドル内が `undefined` のまま固まってしまう。Runtime に値があってもバンドル側は更新されない。

**対処**: Cloudflare の **「Build variables and secrets」**(Runtime とは別セクション)に同じ値を追加登録 →
再ビルドで解決。

**教訓**: `NEXT_PUBLIC_*` は **Build 側必須**。Runtime 側は不要(消えても影響しない)。
Secret(SERVICE_ROLE_KEY 等)は **Runtime のみ**で OK。

---

### B-002 Cloudflare Workers の管理画面で変数名にタイポ

**症状**: B-001 を直したつもりが、まだ同じ「URL and Key are required」エラーが出ていた。

**原因**: Build variables に `NEXT_PUBLIC_SUPABASE_ANON_KEY` を登録したつもりが、
実際には `_PUBLIC_SUPABASE_ANON_KEY`(先頭の `NEXT` が欠落)になっていた。Secret 種別だと値が
暗号化表示されるので、変数名のタイポに気付くのが遅れた。

**対処**: 変数を削除 → 正しい名前で再登録。

**教訓**:
- Cloudflare ダッシュボードで変数を登録する時は **コピペ推奨**
- 登録直後に**変数名を一文字ずつ目視確認**
- Secret 種別は値が見えないので、**名前のチェックが命**

---

### B-003 Cloudflare Workers Builds が `bun install` を勝手に選んだ

**症状**: ビルドログで `bun install` が走り、`peer dependency` 警告が出ていた。
ローカル想定は npm なので、本番と齟齬が出る恐れ。

**原因**: Cloudflare Workers Builds は **環境内のツールを自動検出**し、優先順位で `bun > npm` だった。
リポジトリに `package.json` があれば npm が選ばれる、というわけではない。

**対処**:
1. `package.json` に `"packageManager": "npm@10.9.0"` を明示
2. リポジトリに `package-lock.json` をコミット(`npm install` を一度実行して生成)
3. `.gitignore` に `bun.lock` / `bun.lockb` / `yarn.lock` / `pnpm-lock.yaml` を追加(誤混入防止)

**教訓**: Cloudflare の自動検出は便利だが、**チームの想定と揃わない**ことがある。
パッケージマネージャは明示的に固定する。

---

### B-004 `wrangler deploy` が Plaintext の Runtime 変数を消した

**症状**: B-001 解決のため Runtime 変数も入れていたが、再デプロイのたびに Plaintext 変数だけ消えていた
(Secret は残る)。「変数を入れたのにすぐ消える」現象。

**原因**: `wrangler deploy`(`npx wrangler deploy`)は **`wrangler.jsonc` を `single source of truth`** とみなす設計。
ダッシュボードで設定した Plaintext Variable は、`wrangler.jsonc` に対応する `vars` が無いと**毎回上書き削除**される。
Secret は別管理なので残る。

**対処**: 我々のアプリは `NEXT_PUBLIC_*` をビルド時に inline しているので **Runtime に Plaintext を置く必要が無い**。
Secret(`SUPABASE_SERVICE_ROLE_KEY` / `GEMINI_API_KEY`)だけ Runtime に残し、それ以外は
Build 側だけ登録する運用に統一して回避。

**教訓**: もし将来 Runtime に Plaintext 変数が必要になったら、
`wrangler.jsonc` に `keep_vars: true` を追加 or `vars` セクションに直接書く。

---

### B-005 Bootstrap workflow の `git diff` が untracked ファイルを見落とした

**症状**: `.github/workflows/bootstrap-migrations.yml` が「成功」と表示されているのに、
`supabase/migrations/` に baseline migration ファイルが入っていなかった。
本番 Supabase 側には migration が「適用済み」マークされているのに、Git 側には何も無い不整合状態。

**原因**: workflow 内で
```bash
if git diff --quiet supabase/migrations/; then
  echo "changed=false"
fi
```
としていたが、`git diff` は **追跡されていないファイル(untracked)を検出しない**。
`supabase db pull` が新規作成したファイルは untracked なので、`git diff` は「差分なし」と判定し、
commit/push がスキップされていた。

**対処**: `find supabase/migrations -type f ! -name '.gitkeep'` で実体ファイルの有無を確認する方式に変更。
あわせて、本番側に残った orphan migration を `supabase migration repair --status reverted` で revert する
ステップを追加。

**教訓**: シェルスクリプトで「変更があったか」を判定する時、**`git diff` だけでは不十分**。
新規ファイルも含めるなら `git status --porcelain` か `find` を使う。

---

### B-006 GitHub Actions が無料枠を使い切ってジョブが起動しなくなった

**症状**: 「The job was not started because recent account payments have failed or your spending limit needs to be increased」
というエラーで TypeCheck と Auto-merge が両方失敗。

**原因**: Private リポジトリの Actions 無料枠(月 2,000 分)を月途中で使い切った。
日本時間と GitHub の billing 月次サイクル(UTC)のズレで「月変わったから大丈夫」と思い込んでいた。

**対処**: リポジトリを **Public 化**(Public リポジトリの Actions は無制限・無料)。
コードに secrets を含めない設計を維持していたため、Public 化しても直ちに漏洩リスクは無い。

**教訓**:
- GitHub の課金サイクルは **UTC**(日本時間で月初でも UTC ではまだ前月の場合がある)
- Squmath は社内ツールでロジックや allowed_emails の運用方針が見えるリスクはあるが、
  **Secrets を分離設計**にしていたためこの判断ができた

---

## 記入テンプレート

```md
### B-XXX 簡潔な見出し

**症状**: 何が起きたか

**原因**: 真因は何だったか

**対処**: どう直したか

**教訓**: 同じことを起こさないために覚えておくこと
```
