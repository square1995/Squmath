import { createClient } from "@supabase/supabase-js";

// service_role キーで作る Supabase クライアント。
// RLS をバイパスするため、Route Handler の中だけで使うこと。
// クライアント側に渡したり、Server Component から直接使ったりしないこと。
export function createServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
