import { createClient } from "@supabase/supabase-js";
import { supabaseAuthStorage } from "@/lib/auth/sessionStorage";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: supabaseAuthStorage,
    },
  }
);
