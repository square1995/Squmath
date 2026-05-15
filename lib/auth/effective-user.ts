import { cookies } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { err } from "@/lib/api/response";
import { TABLE } from "@/lib/constants";
import type { User, SupabaseClient } from "@supabase/supabase-js";
import type { AppUserRole } from "@/types/domain";

// 代理操作の Cookie 名(DESIGN.md §3.5)
export const IMPERSONATION_COOKIE = "squmath_impersonate";

export type EffectiveUser = {
  realUser: User;
  realUserRole: AppUserRole;
  effectiveUserId: string;
  isImpersonating: boolean;
  impersonation: {
    id: string;
    target_user_id: string;
    started_at: string;
  } | null;
};

// 代理状態を含む現在のユーザー情報を返す。未ログインなら null。
// Server Component / Route Handler の両方から呼べる。
export async function getEffectiveUser(): Promise<EffectiveUser | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from(TABLE.USERS)
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role ?? "staff") as AppUserRole;

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(IMPERSONATION_COOKIE)?.value;

  if (!cookieValue) {
    return {
      realUser: user,
      realUserRole: role,
      effectiveUserId: user.id,
      isImpersonating: false,
      impersonation: null,
    };
  }

  // 代理セッションの有効性は service_role で確認(他人が改ざんした Cookie を弾く)
  const service = createServiceSupabase();
  const { data: imp } = await service
    .from(TABLE.IMPERSONATIONS)
    .select("id, admin_user_id, target_user_id, started_at, ended_at")
    .eq("id", cookieValue)
    .maybeSingle();

  const isValid =
    imp != null &&
    imp.admin_user_id === user.id &&
    imp.ended_at === null &&
    role === "admin";

  if (!isValid) {
    return {
      realUser: user,
      realUserRole: role,
      effectiveUserId: user.id,
      isImpersonating: false,
      impersonation: null,
    };
  }

  return {
    realUser: user,
    realUserRole: role,
    effectiveUserId: imp.target_user_id,
    isImpersonating: true,
    impersonation: {
      id: imp.id,
      target_user_id: imp.target_user_id,
      started_at: imp.started_at,
    },
  };
}

// Route Handler 用: 未ログインなら 401。
export async function requireEffectiveUser(): Promise<
  | { user: EffectiveUser; response: null }
  | { user: null; response: Response }
> {
  const user = await getEffectiveUser();
  if (!user) {
    return {
      user: null,
      response: err("UNAUTHORIZED", "ログインが必要です", 401),
    };
  }
  return { user, response: null };
}

// admin 必須。代理中でも実 user の role が admin なら通す
// (代理を終了する API 等を呼ぶため)。
export async function requireAdmin(): Promise<
  | { user: EffectiveUser; response: null }
  | { user: null; response: Response }
> {
  const result = await requireEffectiveUser();
  if (result.response) return result;
  if (result.user.realUserRole !== "admin") {
    return {
      user: null,
      response: err("FORBIDDEN", "管理者権限が必要です", 403),
    };
  }
  return result;
}

// 代理中は service_role で書き、通常時は RLS 経由で書く。
// effectiveUserId をフィルタ・INSERT 値として使うこと(RLS バイパス時の安全策)。
export async function getWriteClient(
  user: EffectiveUser,
): Promise<SupabaseClient> {
  if (user.isImpersonating) {
    return createServiceSupabase();
  }
  return createServerSupabase();
}
