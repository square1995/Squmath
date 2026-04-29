// このファイルは GitHub Actions(.github/workflows/sync-supabase-types.yml)が
// Supabase の本番 DB から自動生成します。**手で編集しないでください**。
//
// 初回プレースホルダ: 初回ワークフロー実行までは空の型を置いておく。
// ワークフローが正常終了すると、ここが自動生成された型で上書きされる。

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
