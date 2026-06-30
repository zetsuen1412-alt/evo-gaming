import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type GameMasterRow = {
  id: number;
  name: string;
  slug: string;
  first_letter: string | null;
  image_url: string | null;
  cover_image_url: string | null;
  background_image: string | null;
  offer_count: number | null;
  is_trending: boolean | null;
  is_featured: boolean | null;
  rating: number | null;
  metacritic: number | null;
};

type ProductRow = {
  game_category_id: number | null;
  stock: number | string | null;
};

function numberValue(value: number | string | null | undefined) {
  const numericValue = Number(value || 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function escapePostgrest(value: string) {
  return value.replace(/[%_,]/g, " ").trim();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(Number(searchParams.get("page") || 1), 1);
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit") || 48), 1),
    100
  );
  const queryText = escapePostgrest(searchParams.get("q") || "");
  const letter = String(searchParams.get("letter") || "").toUpperCase();
  const categoryValue = String(searchParams.get("category") || "").trim();
  const offset = (page - 1) * limit;

  let categoryGameIds: number[] | null = null;

  if (categoryValue) {
    const normalizedCategory = categoryValue
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const { data: category, error: categoryError } = await supabase
      .from("categories")
      .select("id,name,slug")
      .or(
        `slug.eq.${normalizedCategory},name.ilike.%${escapePostgrest(
          categoryValue
        )}%`
      )
      .maybeSingle();

    if (categoryError) {
      return NextResponse.json(
        { error: categoryError.message },
        { status: 500 }
      );
    }

    if (!category) {
      return NextResponse.json({
        games: [],
        count: 0,
        page,
        limit,
        totalPages: 0,
      });
    }

    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("game_category_id,stock")
      .eq("status", "active")
      .or(
        `category_id.eq.${category.id},category.ilike.%${escapePostgrest(
          category.name
        )}%`
      )
      .not("game_category_id", "is", null)
      .range(0, 9999);

    if (productsError) {
      return NextResponse.json(
        { error: productsError.message },
        { status: 500 }
      );
    }

    categoryGameIds = Array.from(
      new Set(
        ((products || []) as ProductRow[])
          .filter((product) => numberValue(product.stock) > 0)
          .map((product) => Number(product.game_category_id))
          .filter((id) => Number.isFinite(id) && id > 0)
      )
    );

    if (categoryGameIds.length === 0) {
      return NextResponse.json({
        games: [],
        count: 0,
        page,
        limit,
        totalPages: 0,
      });
    }
  }

  let gamesQuery = supabase
    .from("game_master")
    .select(
      "id,name,slug,first_letter,image_url,cover_image_url,background_image,offer_count,is_trending,is_featured,rating,metacritic",
      { count: "exact" }
    )
    .eq("status", "active")
    .eq("is_active", true);

  if (queryText) {
    const normalized = queryText
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    gamesQuery = gamesQuery.or(
      `normalized_name.ilike.%${queryText.toLowerCase()}%,name.ilike.%${queryText}%,slug.ilike.%${normalized}%`
    );
  }

  if (letter && letter !== "ALL") {
    if (letter === "0-9") {
      gamesQuery = gamesQuery.in("first_letter", [
        "0",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
      ]);
    } else if (/^[A-Z]$/.test(letter)) {
      gamesQuery = gamesQuery.eq("first_letter", letter);
    }
  }

  if (categoryGameIds) {
    gamesQuery = gamesQuery.in("id", categoryGameIds);
  }

  const { data, error, count } = await gamesQuery
    .order("name", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const games = (data || []) as GameMasterRow[];
  const gameIds = games.map((game) => game.id);
  const offerCountByGame = new Map<number, number>();

  if (gameIds.length > 0) {
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("game_category_id,stock")
      .eq("status", "active")
      .in("game_category_id", gameIds)
      .range(0, 9999);

    if (!productsError) {
      for (const product of (products || []) as ProductRow[]) {
        const gameId = Number(product.game_category_id);
        if (!Number.isFinite(gameId) || numberValue(product.stock) <= 0) continue;
        offerCountByGame.set(gameId, (offerCountByGame.get(gameId) || 0) + 1);
      }
    }
  }

  const result = games.map((game) => ({
    ...game,
    first_letter:
      game.first_letter || game.name.trim().charAt(0).toUpperCase() || "#",
    offer_count:
      offerCountByGame.get(game.id) ?? numberValue(game.offer_count),
    is_trending: Boolean(game.is_trending),
    is_featured: Boolean(game.is_featured),
    rating: numberValue(game.rating),
  }));

  const total = count || 0;

  return NextResponse.json({
    games: result,
    count: total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
