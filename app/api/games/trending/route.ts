import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("game_master")
    .select("id,name,slug,image_url,cover_image_url,background_image,offer_count,is_trending,is_featured,rating,metacritic")
    .eq("status", "active")
    .eq("is_active", true)
    .eq("is_trending", true)
    .order("offer_count", { ascending: false })
    .limit(24);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ games: data || [] });
}
