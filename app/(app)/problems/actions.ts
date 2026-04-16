"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function saveProblem(payload: {
  title: string;
  content_latex: string;
  subject: string | null;
  difficulty: number;
}): Promise<{ error: string } | void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "ログインが必要です" };
  }

  const { error } = await supabase.from("problems").insert({
    title: payload.title,
    content_latex: payload.content_latex,
    subject: payload.subject,
    difficulty: payload.difficulty,
    user_id: user.id,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/problems");
}
