import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://uyehruetoxedmookyfcd.supabase.co";
const supabaseAnonKey = "sb_publishable_JPf7KbUQ04dOFrpxYjxKJA_MWu1X6Sk";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);