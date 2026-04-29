import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";

// Google OAuth のコールバックを受けて、
//  1. code をセッションに交換
//  2. allowed_emails を確認
//  3. 許可なら public.users を upsert して /dashboard へ
//  4. 不許可ならサインアウトして /login?error=not_allowed へ
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const origin = url.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=callback_failed`);
  }

  const supabase = await createServerSupabase();
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    console.error("[auth/callback] exchange failed", exchangeError);
    return NextResponse.redirect(`${origin}/login?error=callback_failed`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return NextResponse.redirect(`${origin}/login?error=callback_failed`);
  }

  // allowed_emails の確認は service_role で(staff も自分宛て以外は読めないため)
  const service = createServiceSupabase();
  const { data: allowed, error: allowedError } = await service
    .from("allowed_emails")
    .select("email")
    .eq("email", user.email)
    .maybeSingle();

  if (allowedError) {
    console.error("[auth/callback] allowed_emails query failed", allowedError);
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=callback_failed`);
  }

  if (!allowed) {
    // 許可リストに入っていない → サインアウトしてエラー表示
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=not_allowed`);
  }

  // public.users に upsert(初回ログイン時のみ作成)
  const { error: upsertError } = await service.from("users").upsert(
    {
      id: user.id,
      email: user.email,
      display_name:
        (user.user_metadata && (user.user_metadata.full_name as string)) ||
        null,
    },
    { onConflict: "id" },
  );

  if (upsertError) {
    console.error("[auth/callback] users upsert failed", upsertError);
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=callback_failed`);
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
