import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Problem } from "@/types/domain";
import { ProblemEditor } from "@/components/problems/ProblemEditor";

export default async function ProblemEditPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("problems")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  return <ProblemEditor problem={data as Problem} />;
}
