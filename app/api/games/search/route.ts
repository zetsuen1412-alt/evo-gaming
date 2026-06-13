import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toLowerCase() || "";

  if (q.length < 2) {
    return NextResponse.json({ games: [] });
  }

  const { data, error } = await supabase
    .from("game_master")
    .select(`
      id,
      name,
      slug,
      image_url,
      cover_image_url,
      background_image,
      offer_count,
      is_trending,
      rating
    `)
    .eq("status", "active")
    .eq("is_active", true)
    .ilike("normalized_name", `%${q}%`)
    .order("is_trending", { ascending: false })
    .order("offer_count", { ascending: false })
    .limit(12);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ games: data || [] });
}