// API の入出力型。Route Handler とフロントの両方で参照する。
import type { Problem, ProblemContent, ProblemMeta } from "@/types/domain";

export type CreateProblemBody = {
  title: string;
  content?: ProblemContent;
  meta?: ProblemMeta;
};

export type UpdateProblemBody = Partial<CreateProblemBody>;

export type ProblemResponse = Problem;

export type ProblemListResponse = Problem[];
