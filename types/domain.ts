// アプリのドメイン型。
// DB のスキーマ型は `types/supabase.ts` が GitHub Actions で自動生成する(編集禁止)。
// ここでは自動生成型をベースに、JSONB(content / meta)の構造を絞り込んだ実用型を定義する。

import type { Database } from "./supabase";

// ----- JSONB スキーマ(JSONB のキーは欠落することがある前提でオプショナル) -----

export type ProblemContent = {
  kind?: "math_problem";
  version?: number;
  body_latex?: string;
  answer_latex?: string;
  explanation_latex?: string;
  images?: { storage_path: string; caption?: string }[];
  geogebra?: unknown;
};

export type ProblemMeta = {
  subject?: "math";
  school_level?: "junior" | "high";
  grade?: 1 | 2 | 3;
  unit?: string;
  difficulty?: 1 | 2 | 3 | 4 | 5;
  tag_ids?: string[];
  source?: string;
};

// ----- 自動生成型からの派生 -----

type ProblemRow = Database["public"]["Tables"]["problems"]["Row"];
type UserRow = Database["public"]["Tables"]["users"]["Row"];

// problems テーブルの行(content/meta だけ JSONB 型を絞り込む)
export type Problem = Omit<ProblemRow, "content" | "meta"> & {
  content: ProblemContent;
  meta: ProblemMeta;
};

export type AppUserRole = "staff" | "admin";

// users テーブルの行(role のリテラル型化)
export type AppUser = Omit<UserRow, "role"> & {
  role: AppUserRole;
};
