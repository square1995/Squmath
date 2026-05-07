# DATA.md — データ構造

このドキュメントは、Supabase(PostgreSQL)上のテーブル定義、JSONB スキーマ、RLS ポリシー、インデックス、生成カラムなど **データレイヤーの設計意図** を記録するものです。
コードを書く前に必ずこのファイルを参照する。設計の背景は `DESIGN.md`、デプロイは `DEPLOY.md`。

> 📝 **2026-04-29 更新**: DB スキーマの**実際の適用は `supabase/migrations/` の migration ファイル経由**(GitHub Actions が自動で本番適用)。このファイルは**設計意図と JSONB スキーマの記述**を中心に置き、SQL の正解は `supabase/migrations/` を参照する。運用ルールは [supabase/README.md](./supabase/README.md) と CODING.md §9.5 を参照。

---

## 0. このドキュメントの位置づけ

- ここに書かれた設計意図と JSONB スキーマを参考に、新しい migration ファイルを書く。
- 変更があったら**新しい migration ファイル**を `supabase/migrations/` に追加し、このファイルの記述も合わせて更新する。
- 既存カラムの**型・意味の変更は禁止**(必ず新規追加で対応 → CLAUDE.md NEVER 参照)。
- Supabase ダッシュボードの SQL Editor で**直接スキーマを変更してはいけない**(Git と本番が乖離する)。

---

## 1. テーブル一覧

| テーブル | 役割 | Phase | owner_id の運用 |
|---|---|---|---|
| `users` | アプリ側のプロファイル(`auth.users` を拡張) | Phase 1 | — |
| `allowed_emails` | ログイン許可メアドリスト | Phase 1 | — |
| `problems` | 問題本体(JSONB content/meta で拡張) | Phase 1 | NULL = master / NOT NULL = 個人 |
| `tags` | タグ(master + 個人) | Phase 2 | NULL = master / NOT NULL = 個人 |
| `problem_tags` | 問題とタグの中間テーブル | Phase 2 | — |
| `folders` | フォルダ階層 | Phase 2 後半 | NULL = master / NOT NULL = 個人 |
| `worksheets` | プリント本体 | Phase 3 | 同上 |
| `worksheet_blocks` | プリント内の問題ブロック(問題参照 or 自由記述) | Phase 3 | — |
| `audit_logs` | 重要操作の監査ログ(任意・将来) | Phase 7 | — |

**Phase 1 では `users` / `allowed_emails` / `problems` の 3 つだけ作成**する。
Phase 2 以降のテーブルは、その Phase に着手するときに本ファイルを更新したうえで作る。

### master / 個人 の二段構造(2026-05-07 シンジさんの方針で正式化)

`owner_id IS NULL` を **master(全員共通)** として扱うルールは Phase 1 から `problems` で運用していたが、Phase 2 で `tags` にも同じルールを適用する。詳細は DESIGN.md §3 を参照。

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

### 2.5 `tags`(Phase 2 で追加予定)

> 📝 **設計のみここに記載**。実際の本番適用は新しい migration ファイル(`supabase/migrations/<timestamp>_add_tags.sql`)を追加して GitHub Actions 経由で行う(CODING.md §9.5)。

```sql
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text,                                  -- 任意(例: '#FF6B6B')。UI で表示色に使う
  owner_id uuid references public.users(id) on delete cascade,
  -- ↑ NULL = マスタータグ(全員共通)/ NOT NULL = 個人タグ(本人のみ)
  created_by uuid references public.users(id) on delete set null,
  -- ↑ 実際に作った人(監査用)。owner_id とは別に保持する(master 化されても作者が分かるように)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 名前重複防止: master タグは全体で 1 つ、個人タグは owner_id ごとに 1 つ
create unique index tags_name_master_unique
  on public.tags (name)
  where owner_id is null and deleted_at is null;

create unique index tags_name_personal_unique
  on public.tags (owner_id, name)
  where owner_id is not null and deleted_at is null;

create index tags_owner_id_idx on public.tags (owner_id);
create index tags_deleted_at_idx on public.tags (deleted_at);

alter table public.tags enable row level security;

-- SELECT: master タグ + 自分の個人タグ(削除済みは除外)
create policy "tags_select_master_or_own"
  on public.tags for select
  using (
    deleted_at is null
    and (owner_id is null or owner_id = auth.uid())
  );

-- SELECT: admin は全件
create policy "tags_select_admin"
  on public.tags for select
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
        and users.deleted_at is null
    )
  );

-- INSERT: 個人タグは本人のみ
create policy "tags_insert_personal"
  on public.tags for insert
  with check (owner_id = auth.uid());

-- INSERT: master タグは admin のみ(owner_id IS NULL を許可するのは admin だけ)
create policy "tags_insert_master_admin"
  on public.tags for insert
  with check (
    owner_id is null
    and exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
        and users.deleted_at is null
    )
  );

-- UPDATE: 個人タグは本人のみ
create policy "tags_update_personal"
  on public.tags for update
  using (owner_id = auth.uid() and deleted_at is null)
  with check (owner_id = auth.uid());

-- UPDATE: master タグは admin のみ(論理削除も含む)
create policy "tags_update_master_admin"
  on public.tags for update
  using (
    owner_id is null
    and exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
        and users.deleted_at is null
    )
  )
  with check (owner_id is null);

create trigger tags_set_updated_at
  before update on public.tags
  for each row execute function public.set_updated_at();
```

#### NEVER(tags 関連)

- ❌ master タグの owner_id を後から個人 ID に書き換える(意味が変わるため、UPDATE で `owner_id` を触る経路は service_role でも残さない)
- ❌ tags の物理削除(論理削除のみ。物理削除は admin が SQL Editor で慎重に)

### 2.6 `problem_tags`(Phase 2 で追加予定)

```sql
create table public.problem_tags (
  problem_id uuid not null references public.problems(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (problem_id, tag_id)
);

create index problem_tags_tag_id_idx on public.problem_tags (tag_id);
create index problem_tags_problem_id_idx on public.problem_tags (problem_id);

alter table public.problem_tags enable row level security;

-- SELECT: 親問題が見えるなら中間も見える(問題側の RLS が可視性を制御するので、ここは緩く)
create policy "problem_tags_select_via_problem"
  on public.problem_tags for select
  using (
    exists (
      select 1 from public.problems p
      where p.id = problem_id
    )
  );

-- INSERT: 自分の個人問題に対してのみ。master 問題への直接の付与は admin が service_role で行う
create policy "problem_tags_insert_own_problem"
  on public.problem_tags for insert
  with check (
    exists (
      select 1 from public.problems p
      where p.id = problem_id and p.owner_id = auth.uid()
    )
    -- かつタグも閲覧可能なもの(master か自分の個人タグ)
    and exists (
      select 1 from public.tags t
      where t.id = tag_id
        and t.deleted_at is null
        and (t.owner_id is null or t.owner_id = auth.uid())
    )
  );

-- DELETE: 自分の個人問題に対してのみ
create policy "problem_tags_delete_own_problem"
  on public.problem_tags for delete
  using (
    exists (
      select 1 from public.problems p
      where p.id = problem_id and p.owner_id = auth.uid()
    )
  );
```

#### `meta.tag_ids` との関係

- **Phase 2 以降は `problem_tags` を真とする**(中間テーブルが正)
- `meta.tag_ids` は使わない(JSONB の値と中間テーブルの二重管理を避けるため)
- もし過去に `meta.tag_ids` を入れたデータがあれば、Phase 2 着手時の data migration 時に空配列にする(または無視する)

### 2.7 `updated_at` 自動更新トリガ

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
  "source": "Studyaid 2024 春"    // 出典(任意)
}
```

**ルール**:
- 検索条件として使う項目は `meta` に入れて、必要なら**生成カラム**で取り出してインデックス対象にする。
- **タグは `problem_tags` 中間テーブルを正とする**(2026-05-07 シンジさんの方針)。`meta.tag_ids` も `meta.tags` も使わない(二重管理を避ける、`tags` テーブルへ正規化済み)。

### 3.3 `worksheet_blocks.content`(Phase 3 以降)

(Phase 3 着手時にこのファイルへ追記する)

---

## 4. RLS ポリシーの全体方針

| テーブル | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `users` | 自分 + admin は全員 | (Route Handler が service_role で作成) | 自分の安全列のみ | (使わない) |
| `allowed_emails` | admin のみ | admin のみ | admin のみ | admin のみ |
| `problems` | 自分 + master + admin は全部 | 自分の owner_id のみ(master 化は service_role) | 自分の owner_id のみ(master 編集は service_role + admin チェック) | (使わない、論理削除を UPDATE) |
| `tags` | master + 自分の個人タグ + admin は全件 | 個人は本人 / master は admin | 個人は本人 / master は admin | (使わない、論理削除を UPDATE) |
| `problem_tags` | 親 problem が見える時のみ | 自分の個人問題に対してのみ | (使わない) | 自分の個人問題に対してのみ |

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
