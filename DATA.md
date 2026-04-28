# DATA.md — データ構造

このドキュメントは、Supabase(PostgreSQL)上のテーブル定義、JSONB スキーマ、RLS ポリシー、インデックス、生成カラムなど **データレイヤーの正解** を記録するものです。
コードを書く前に必ずこのファイルを参照する。設計の背景は `DESIGN.md`、デプロイは `DEPLOY.md`。

---

## 0. このドキュメントの位置づけ

- ここに書かれた CREATE TABLE 文をそのまま Supabase の SQL Editor で実行できる。
- 変更があったら**必ずこのファイルを先に更新**してから、Supabase に反映する。
- 既存カラムの**型・意味の変更は禁止**(必ず新規追加で対応 → CLAUDE.md NEVER 参照)。

---

## 1. テーブル一覧

| テーブル | 役割 | Phase |
|---|---|---|
| `users` | アプリ側のプロファイル(`auth.users` を拡張) | Phase 1 |
| `allowed_emails` | ログイン許可メアドリスト | Phase 1 |
| `problems` | 問題本体(JSONB content/meta で拡張) | Phase 1 |
| `tags` | タグマスター | Phase 2 |
| `problem_tags` | 問題とタグの中間テーブル | Phase 2 |
| `folders` | フォルダ階層 | Phase 2 |
| `worksheets` | プリント本体 | Phase 3 |
| `worksheet_blocks` | プリント内の問題ブロック(問題参照 or 自由記述) | Phase 3 |
| `audit_logs` | 重要操作の監査ログ(任意・将来) | Phase 7 |

**Phase 1 では `users` / `allowed_emails` / `problems` の 3 つだけ作成**する。
Phase 2 以降のテーブルは、その Phase に着手するときに本ファイルを更新したうえで作る。

---

## 2. CREATE TABLE 文(Phase 1 分)

下記をすべて **Supabase の SQL Editor** にコピペして実行する。

### 2.1 拡張機能

```sql
-- UUID 生成のため(Supabase はデフォルトで有効だが念のため)
create extension if not exists "uuid-ossp";
-- インデックス用(Phase 2 で必要)
create extension if not exists pg_trgm;
```

### 2.2 `allowed_emails`

```sql
create table public.allowed_emails (
  email text primary key,
  note text,                                     -- 用途メモ(任意)
  added_by uuid references auth.users(id),      -- 誰が追加したか
  created_at timestamptz not null default now()
);

alter table public.allowed_emails enable row level security;

-- staff は閲覧のみ、admin だけが書ける(role 判定は public.users で行う)
create policy "allowed_emails_select_admin"
  on public.allowed_emails for select
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
        and users.deleted_at is null
    )
  );

create policy "allowed_emails_modify_admin"
  on public.allowed_emails for all
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
        and users.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
        and users.deleted_at is null
    )
  );
```

### 2.3 `users`

```sql
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  role text not null default 'staff' check (role in ('staff', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.users enable row level security;

-- 自分のプロファイルは閲覧可能
create policy "users_select_self"
  on public.users for select
  using (id = auth.uid() and deleted_at is null);

-- admin は全員のプロファイルを閲覧可能
create policy "users_select_admin"
  on public.users for select
  using (
    exists (
      select 1 from public.users u2
      where u2.id = auth.uid()
        and u2.role = 'admin'
        and u2.deleted_at is null
    )
  );

-- 自分のプロファイル更新(role と deleted_at は更新できない設計にしたいので、
--  重要列の変更は Route Handler のサービスロールキー経由で行う)
create policy "users_update_self_safe"
  on public.users for update
  using (id = auth.uid() and deleted_at is null)
  with check (id = auth.uid());
```

⚠️ `role` の変更や `deleted_at` の付与は **Route Handler が `service_role` キー** で行う。普通の RLS 経由だと self-promotion(自分で自分を admin にする)を防げないため。

### 2.4 `problems`

```sql
create table public.problems (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.users(id) on delete cascade,  -- NULL = master データ
  title text not null,
  content jsonb not null default '{}'::jsonb,    -- 問題本文 (詳細は §3)
  meta jsonb not null default '{}'::jsonb,        -- 検索用メタデータ (詳細は §3)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 検索用の生成カラム(Phase 2 で本格活用)
alter table public.problems
  add column subject text generated always as (meta->>'subject') stored,
  add column school_level text generated always as (meta->>'school_level') stored,
  add column grade int generated always as ((meta->>'grade')::int) stored,
  add column unit text generated always as (meta->>'unit') stored,
  add column difficulty int generated always as ((meta->>'difficulty')::int) stored;

alter table public.problems enable row level security;

-- staff は「自分の問題」または「master 問題(owner_id IS NULL)」を閲覧可能
create policy "problems_select_staff"
  on public.problems for select
  using (
    deleted_at is null
    and (
      owner_id = auth.uid()
      or owner_id is null
    )
  );

-- admin は deleted_at に関わらず全部見える
create policy "problems_select_admin"
  on public.problems for select
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
        and users.deleted_at is null
    )
  );

-- 書き込みは「自分のデータ」だけ。owner_id を NULL(master 化)にする操作は
-- フロント経由では禁止 → Route Handler のサービスロールキー経由のみ。
create policy "problems_insert_self"
  on public.problems for insert
  with check (
    owner_id = auth.uid()
  );

create policy "problems_update_self"
  on public.problems for update
  using (
    owner_id = auth.uid() and deleted_at is null
  )
  with check (
    owner_id = auth.uid()
  );

create policy "problems_soft_delete_self"
  on public.problems for update
  using (
    owner_id = auth.uid()
  )
  with check (
    owner_id = auth.uid()
  );
-- ※ DELETE は基本的に使わせない(論理削除は UPDATE で deleted_at をセット)

-- インデックス
create index problems_owner_id_idx on public.problems (owner_id);
create index problems_subject_idx on public.problems (subject);
create index problems_school_level_grade_idx on public.problems (school_level, grade);
create index problems_unit_idx on public.problems (unit);
create index problems_difficulty_idx on public.problems (difficulty);
create index problems_deleted_at_idx on public.problems (deleted_at);

-- 全文検索(Phase 2 で本格利用)
create index problems_title_trgm_idx on public.problems
  using gin (title gin_trgm_ops);
```

### 2.5 `updated_at` 自動更新トリガ

```sql
-- 共通の更新時刻トリガ関数
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 各テーブルにトリガを張る
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create trigger problems_set_updated_at
  before update on public.problems
  for each row execute function public.set_updated_at();
```

---

## 3. JSONB スキーマ

### 3.1 `problems.content`(問題本文)

```jsonc
{
  "kind": "math_problem",      // 種類(将来 "true_false" など追加可能)
  "version": 1,                // スキーマバージョン(将来の拡張に備える)
  "body_latex": "次の方程式を解け。\\(x^2 + 2x - 3 = 0\\)",  // 問題文(LaTeX 込み)
  "answer_latex": "x = 1, -3",                                 // 解答
  "explanation_latex": "...",                                  // 解説(任意)
  "images": [                                                  // 添付画像(任意)
    { "storage_path": "problems/abc.jpg", "caption": "図1" }
  ],
  "geogebra": null            // GeoGebra 図形定義(Phase 6 で利用、任意)
}
```

**ルール**:
- すべてのキーは**任意**にする(必須キーを増やすと既存データが壊れる)。コードでは欠落キーを許容する。
- 新しいキーを足すときは `version` を上げる(`1 → 2`)。古いバージョンの読み込み処理を残す。

### 3.2 `problems.meta`(検索用メタデータ)

```jsonc
{
  "subject": "math",              // 教科(数学固定だが将来のため記録)
  "school_level": "high",         // junior(中学) / high(高校)
  "grade": 1,                     // 1, 2, 3
  "unit": "二次方程式",           // 単元名
  "difficulty": 3,                // 1〜5
  "tag_ids": [                    // タグ ID(Phase 2 で正規化テーブル参照)
    "uuid-aaaa", "uuid-bbbb"
  ],
  "source": "Studyaid 2024 春"    // 出典(任意)
}
```

**ルール**:
- 検索条件として使う項目は `meta` に入れて、必要なら**生成カラム**で取り出してインデックス対象にする。
- `tag_ids` の配列は `meta` に入れるが、**`meta.tags` のような名前の配列はやめる**(CLAUDE.md NEVER 参照、`tags` テーブルへ正規化する設計のため)。

### 3.3 `worksheet_blocks.content`(Phase 3 以降)

(Phase 3 着手時にこのファイルへ追記する)

---

## 4. RLS ポリシーの全体方針

| テーブル | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `users` | 自分 + admin は全員 | (Route Handler が service_role で作成) | 自分の安全列のみ | (使わない) |
| `allowed_emails` | admin のみ | admin のみ | admin のみ | admin のみ |
| `problems` | 自分 + master + admin は全部 | 自分の owner_id のみ | 自分の owner_id のみ | (使わない、論理削除を UPDATE) |

**サービスロール(`service_role`)経由の書き込み**は RLS をバイパスする。Route Handler 内で:
- 初回ログイン時の `users` 作成
- master データの作成・差し替え
- admin による `users.role` の変更
- などに限定して使う。フロントから service_role を呼べない構造にする(`SUPABASE_SERVICE_ROLE_KEY` は `NEXT_PUBLIC_*` ではないので、サーバー側でのみ参照可能)。

---

## 5. インデックス方針

### 5.1 Phase 1 で張るもの(`problems` 用)

§2.4 の `create index ...` 参照。

### 5.2 Phase 2 以降で追加予定

- `tags`, `folders`, `worksheets` の primary key と外部キー
- `problems.title` への全文検索用 GIN インデックス(`pg_trgm`)
- 必要に応じて部分インデックス(`WHERE deleted_at IS NULL`)で絞る

---

## 6. 生成カラム(Generated Columns)

`problems` に以下の生成カラムを定義済み(§2.4):

| カラム | 元 | 用途 |
|---|---|---|
| `subject` | `meta->>'subject'` | 教科で絞り込み |
| `school_level` | `meta->>'school_level'` | 中学/高校で絞り込み |
| `grade` | `(meta->>'grade')::int` | 学年で絞り込み |
| `unit` | `meta->>'unit'` | 単元で絞り込み |
| `difficulty` | `(meta->>'difficulty')::int` | 難易度で絞り込み |

**理由**:
- JSONB のままだと検索性能が悪い & インデックスを張りにくい
- 生成カラムにすれば普通のカラムと同じように `WHERE` できてインデックスも張れる
- アプリ側は `meta` を JSON として書き換えるだけで OK(生成カラムは PostgreSQL が自動更新)

**ルール**:
- 生成カラムは「検索用の派生」と割り切る。アプリのロジックでは `meta` を真とする。
- 新しい検索軸を増やしたら、ここに追記してから `ALTER TABLE ... ADD COLUMN ... GENERATED ALWAYS AS ...` を実行。

---

## 7. 論理削除の運用

### 7.1 ルール再掲(DESIGN.md §7 と同じ)

- 削除は `deleted_at` を立てる。物理削除はしない。
- すべての SELECT は `WHERE deleted_at IS NULL` を付ける(RLS で表現済み)。
- 完全削除は admin が SQL Editor から手動で行う。

### 7.2 復元 SQL(参考)

```sql
-- staff が「間違えて削除した」と言ってきたとき(admin が実行)
update public.problems
set deleted_at = null, updated_at = now()
where id = '<uuid>';
```

### 7.3 古い論理削除データの掃除(任意)

例: 30 日経った論理削除データを admin が定期的に物理削除する場合は cron で:

```sql
delete from public.problems
where deleted_at is not null
  and deleted_at < now() - interval '30 days';
```

(運用が固まるまでは実行しない。手動オペレーションで様子を見る)

---

## 8. 初期データ投入

### 8.1 admin のメアドを `allowed_emails` に登録

Supabase ダッシュボードの SQL Editor で実行:

```sql
insert into public.allowed_emails (email, note)
values ('shinji@example.com', 'admin'); -- 実際のシンジさんのメアドに置き換える
```

### 8.2 admin ロールへの昇格

シンジさんが初回ログイン後に `public.users` に行ができる。その後 SQL Editor で:

```sql
update public.users
set role = 'admin'
where email = 'shinji@example.com';
```

### 8.3 staff 追加

- `allowed_emails` に staff のメアドを追加するだけ。
- staff は初回ログイン時に `public.users` に自動作成され、`role` は `'staff'` のまま。

---

## 9. このドキュメントの更新タイミング

以下の場合は必ずこのファイルを更新する:

- 新しいテーブルを追加した
- 既存テーブルにカラムを追加した(**型変更・意味変更は NG**)
- RLS ポリシーを変更した
- 新しいインデックス・生成カラムを追加した
- JSONB スキーマを拡張した(version を上げた、新キーを足した)

更新したら CLAUDE.md §9 のルールに従って Claude Code が自動で報告する。
