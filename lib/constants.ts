import type { ProblemListSort } from "@/types/api";

// アプリ表示名
export const APP_NAME = "Squmath";

// ページルート
export const ROUTES = {
  LOGIN: "/login",
  DASHBOARD: "/dashboard",
  PROBLEMS: "/problems",
  PROBLEMS_NEW: "/problems/new",
  ADMIN_USERS: "/admin/users",
} as const;

// API ルート
export const API = {
  PROBLEMS: "/api/problems",
  ADMIN_IMPERSONATIONS: "/api/admin/impersonations",
  ME_IMPERSONATION: "/api/me/impersonation",
} as const;

// DB テーブル名
export const TABLE = {
  USERS: "users",
  PROBLEMS: "problems",
  IMPERSONATIONS: "impersonations",
  ALLOWED_EMAILS: "allowed_emails",
} as const;

// 問題一覧の並び順定義(API・画面の両方で共有)
export const SORT_MAP: Record<
  ProblemListSort,
  { column: "updated_at" | "created_at" | "title"; ascending: boolean }
> = {
  updated_desc: { column: "updated_at", ascending: false },
  updated_asc: { column: "updated_at", ascending: true },
  created_desc: { column: "created_at", ascending: false },
  created_asc: { column: "created_at", ascending: true },
  title_asc: { column: "title", ascending: true },
};

// ページネーション
export const PAGINATION = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 100,
} as const;
