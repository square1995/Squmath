// API の入出力型。Route Handler とフロントの両方で参照する。
import type { Problem, ProblemContent, ProblemMeta } from "@/types/domain";

export type CreateProblemBody = {
  title: string;
  content?: ProblemContent;
  meta?: ProblemMeta;
};

export type UpdateProblemBody = Partial<CreateProblemBody>;

export type ProblemResponse = Problem;

// ----- 一覧取得(Phase 2: 絞り込み・並び替え対応) -----

export type ProblemListSort =
  | "updated_desc"
  | "updated_asc"
  | "created_desc"
  | "created_asc"
  | "title_asc";

export type ProblemListQuery = {
  q?: string;
  subject?: string;
  school_level?: "junior" | "high";
  grade?: number;
  unit?: string;
  difficulty?: number;
  sort?: ProblemListSort;
  limit?: number;
  offset?: number;
};

export type ProblemListResponse = {
  items: Problem[];
  next_offset: number | null;
  returned: number;
};
