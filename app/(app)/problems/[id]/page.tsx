import { notFound, redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { getEffectiveUser } from "@/lib/auth/effective-user";
import type { Problem } from "@/types/domain";
import { ProblemEditor } from "@/components/problems/ProblemEditor";

export default async function ProblemEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getEffectiveUser();
  if (!user) redirect("/login");

  const supabase = user.isImpersonating
    ? createServiceSupabase()
    : await createServerSupabase();

  const { data, error } = await supabase
    .from("problems")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  if (user.isImpersonating) {
    if (data.owner_id !== null && data.owner_id !== user.effectiveUserId) {
      notFound();
    }
  }

  return <ProblemEditor problem={data as Problem} />;
}
