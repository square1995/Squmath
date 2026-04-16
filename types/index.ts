export type Subject =
  | "数学I"
  | "数学A"
  | "数学II"
  | "数学B"
  | "数学III"
  | "数学C"
  | "その他";

export interface Problem {
  id: string;
  user_id: string;
  title: string;
  content_latex: string | null;
  subject: Subject | null;
  difficulty: number | null;
  created_at: string;
}

export interface Worksheet {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  created_at: string;
}

export interface WorksheetProblem {
  worksheet_id: string;
  problem_id: string;
  sort_order: number;
  problem?: Problem;
}
