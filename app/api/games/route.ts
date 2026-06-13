import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const q = searchParams.get("q")?.trim().toLowerCase() || "";
  const letter = searchParams.get("letter")?.trim().toUpperCase() || "";
  const categorySlug = searchParams.get("category")?.trim() || "";
  const page = Math.max(Number(searchParams.get("page") || 1), 1);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 48), 1), 96);

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let offerCountByGameId = new Map<number, number>();

  if (categorySlug) {
    const normalizedCategorySlug = decodeURIComponent(categorySlug)
      .trim()
      .toLowerCase();

    const { data: categoryData, error: categoryError } = await supabase
      .from("categories")
      .select("id, name, slug")
      .or(`slug.eq.${normalizedCategorySlug},name.ilike.${normalizedCategorySlug.replace(/-/g, " ")}`)
      .maybeSingle();

    if (categoryError) {
      return NextResponse.json({ error: categoryError.message }, { status: 500 });
    }

    if (!categoryData) {
      return NextResponse.json({
        games: [],
        count: 0,
        page,
        limit,
      });
    }

    const categoryName = categoryData.name || normalizedCategorySlug;
    const categoryProductValues = Array.from(
      new Set([
        categoryName,
        categoryData.slug,
        normalizedCategorySlug,
        normalizedCategorySlug.replace(/-/g, " "),
      ].filter(Boolean))
    );

    const { data: productData, error: productError } = await supabase
      .from("products")
      .select("game_category_id")
      .eq("status", "active")
      .not("game_category_id", "is", null)
      .or(
        `category_id.eq.${categoryData.id},category.in.(${categoryProductValues
          .map((value) => `"${String(value).replace(/"/g, '\"')}"`)
          .join(",")})`
      )
      .range(0, 9999);

    if (productError) {
      return NextResponse.json({ error: productError.message }, { status: 500 });
    }

    offerCountByGameId = (productData || []).reduce((map, item) => {
      const gameId = Number(item.game_category_id);

      if (Number.isFinite(gameId) && gameId > 0) {
        map.set(gameId, (map.get(gameId) || 0) + 1);
      }

      return map;
    }, new Map<number, number>());

  }

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

  const games = categorySlug
    ? (data || []).map((game) => ({
        ...game,
        offer_count: offerCountByGameId.get(Number(game.id)) || 0,
      }))
    : data || [];

  return NextResponse.json({
    games,
    count: count || 0,
    page,
    limit,
  });
}