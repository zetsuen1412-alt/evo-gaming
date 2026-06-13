import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const gameSlug = searchParams.get("game") || "";
  const limit = Math.min(Number(searchParams.get("limit") || 100), 100);

  if (!gameSlug) {
    return NextResponse.json({ products: [] });
  }

  const { data: gameData } = await supabase
    .from("game_master")
    .select("name, slug")
    .eq("slug", gameSlug)
    .maybeSingle();

  const gameName = gameData?.name || gameSlug;

  const { data, error } = await supabase
    .from("products")
    .select(`
      id,
      title,
      slug,
      price,
      image_url,
      category,
      status,
      seller_id,
      seller_name,
      created_at,
      game_name
    `)
    .ilike("game_name", gameName)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json(
      { products: [], error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ products: data || [] });
}