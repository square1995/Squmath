"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={signingOut}
      className="w-full px-2 py-1.5 rounded text-left text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-50"
    >
      {signingOut ? "ログアウト中..." : "ログアウト"}
    </button>
  );
}
