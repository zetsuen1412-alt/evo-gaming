import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const q = searchParams.get("q")?.trim().toLowerCase() || "";
  const letter = searchParams.get("letter")?.trim().toUpperCase() || "";
  const page = Math.max(Number(searchParams.get("page") || 1), 1);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 48), 1), 96);

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("game_master")
    .select(
      `
      id,
      name,
      slug,
      first_letter,
      image_url,
      cover_image_url,
      background_image,
      offer_count,
      is_trending,
      is_featured,
      rating,
      metacritic,
      genres,
      platforms
      `,
      { count: "exact" }
    )
    .eq("status", "active")
    .eq("is_active", true)
    .order("is_trending", { ascending: false })
    .order("offer_count", { ascending: false })
    .order("name", { ascending: true })
    .range(from, to);

  if (q) {
    query = query.ilike("normalized_name", `%${q}%`);
  }

  if (letter) {
    query = query.eq("first_letter", letter === "0-9" ? "#" : letter);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    games: data || [],
    count: count || 0,
    page,
    limit,
  });
}