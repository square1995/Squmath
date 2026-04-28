// アプリのドメイン型。DB のテーブル構造と対応する。
// JSONB のキーは欠落することがある前提で、すべてオプショナルにしておく。

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

export type Problem = {
  id: string;
  owner_id: string | null;
  title: string;
  content: ProblemContent;
  meta: ProblemMeta;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // 生成カラム(SELECT で取れる、書き込みは不可)
  subject: string | null;
  school_level: string | null;
  grade: number | null;
  unit: string | null;
  difficulty: number | null;
};

export type AppUserRole = "staff" | "admin";

export type AppUser = {
  id: string;
  email: string;
  display_name: string | null;
  role: AppUserRole;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};
