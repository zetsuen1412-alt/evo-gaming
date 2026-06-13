import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const gameSlug = searchParams.get("game") || "";
  const categoryParam = searchParams.get("category")?.trim() || "";
  const limit = Math.min(Number(searchParams.get("limit") || 100), 100);

  if (!gameSlug) {
    return NextResponse.json({ products: [] });
  }

  const { data: gameData } = await supabase
    .from("game_master")
    .select("id, name, slug")
    .eq("slug", gameSlug)
    .maybeSingle();

  const gameId = gameData?.id ? Number(gameData.id) : null;
  const gameName = gameData?.name || gameSlug;

  const normalizedCategory = categoryParam
    ? decodeURIComponent(categoryParam)
        .trim()
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    : "";

  let categoryId: number | null = null;
  let categoryValues: string[] = [];

  if (normalizedCategory) {
    const categoryNameCandidate = normalizedCategory.replace(/-/g, " ");

    const { data: categoryData, error: categoryError } = await supabase
      .from("categories")
      .select("id,name,slug")
      .or(`slug.eq.${normalizedCategory},name.ilike.${categoryNameCandidate}`)
      .maybeSingle();

    if (categoryError) {
      return NextResponse.json(
        { products: [], error: categoryError.message },
        { status: 500 }
      );
    }

    if (!categoryData) {
      return NextResponse.json({ products: [] });
    }

    categoryId = Number(categoryData.id);
    categoryValues = Array.from(
      new Set(
        [
          categoryData.name,
          categoryData.slug,
          normalizedCategory,
          categoryNameCandidate,
        ].filter(Boolean)
      )
    );
  }

  let query = supabase
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
      game_name,
      game_category_id
    `)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (gameId) {
    query = query.eq("game_category_id", gameId);
  } else {
    query = query.ilike("game_name", gameName);
  }

  if (categoryId) {
    const categoryValueList = categoryValues
      .map((value) => `"${String(value).replace(/"/g, '\"')}"`)
      .join(",");

    query = query.or(`category_id.eq.${categoryId},category.in.(${categoryValueList})`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { products: [], error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ products: data || [] });
}