import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Problem } from "@/types/domain";
import { ProblemEditor } from "@/components/problems/ProblemEditor";

export const runtime = "edge";

export default async function ProblemEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("problems")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  return <ProblemEditor problem={data as Problem} />;
}
