import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type GameRow = {
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
  cover_image_url: string | null;
  background_image: string | null;
  offer_count: number | null;
  is_trending: boolean | null;
  rating: number | null;
};

type ProductRow = {
  id: number;
  title: string;
  slug: string | null;
  price: number | string | null;
  image_url: string | null;
  category: string | null;
  game_name: string | null;
  seller_name: string | null;
  created_at: string;
};

type CategoryRow = {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
};

function normalizeSearch(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeIlike(value: string) {
  return value.replace(/[%_]/g, "\\$&").replace(/,/g, " ");
}

function productHref(product: ProductRow) {
  return `/product/${product.slug || product.id}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q")?.trim() || "";
  const rawCategory = searchParams.get("category")?.trim() || "";
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 8), 1), 20);

  if (rawQuery.length < 2 && rawCategory.length < 2) {
    return NextResponse.json({
      query: rawQuery,
      games: [],
      products: [],
      categories: [],
    });
  }

  const normalizedQuery = normalizeSearch(rawQuery);
  const searchText = escapeIlike(rawQuery.toLowerCase());
  const normalizedCategory = normalizeSearch(rawCategory);
  const categoryNameCandidate = normalizedCategory.replace(/-/g, " ");

  let categoryFilter: CategoryRow | null = null;

  if (normalizedCategory) {
    const { data: categoryData, error: categoryError } = await supabase
      .from("categories")
      .select("id,name,slug,icon")
      .or(`slug.eq.${normalizedCategory},name.ilike.${categoryNameCandidate}`)
      .maybeSingle();

    if (categoryError) {
      return NextResponse.json({ error: categoryError.message }, { status: 500 });
    }

    categoryFilter = categoryData || null;
  }

  const productCategoryValues = categoryFilter
    ? Array.from(
        new Set(
          [
            categoryFilter.name,
            categoryFilter.slug,
            normalizeSearch(categoryFilter.name),
            categoryNameCandidate,
          ].filter(Boolean)
        )
      )
    : [];

  const gamesQuery = supabase
    .from("game_master")
    .select(
      "id,name,slug,image_url,cover_image_url,background_image,offer_count,is_trending,rating"
    )
    .eq("status", "active")
    .eq("is_active", true)
    .or(`normalized_name.ilike.%${searchText}%,name.ilike.%${searchText}%,slug.ilike.%${normalizedQuery}%`)
    .order("is_trending", { ascending: false })
    .order("offer_count", { ascending: false })
    .limit(limit);

  let productsQuery = supabase
    .from("products")
    .select(
      "id,title,slug,price,image_url,category,game_name,seller_name,created_at,category_id"
    )
    .eq("status", "active")
    .or(`title.ilike.%${searchText}%,description.ilike.%${searchText}%,game_name.ilike.%${searchText}%,category.ilike.%${searchText}%`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (categoryFilter) {
    const productCategoryList = productCategoryValues
      .map((value) => `"${String(value).replace(/"/g, '\\"')}"`)
      .join(",");

    productsQuery = productsQuery.or(
      `category_id.eq.${categoryFilter.id},category.in.(${productCategoryList})`
    );
  }

  const categoriesQuery = supabase
    .from("categories")
    .select("id,name,slug,icon")
    .or(`name.ilike.%${searchText}%,slug.ilike.%${normalizedQuery}%`)
    .order("id", { ascending: true })
    .limit(6);

  const [gamesResult, productsResult, categoriesResult] = await Promise.all([
    gamesQuery,
    productsQuery,
    categoriesQuery,
  ]);

  if (gamesResult.error) {
    return NextResponse.json({ error: gamesResult.error.message }, { status: 500 });
  }

  if (productsResult.error) {
    return NextResponse.json({ error: productsResult.error.message }, { status: 500 });
  }

  if (categoriesResult.error) {
    return NextResponse.json({ error: categoriesResult.error.message }, { status: 500 });
  }

  const games = ((gamesResult.data || []) as GameRow[]).map((game) => ({
    ...game,
    href: categoryFilter
      ? `/games/${game.slug}/offers?category=${encodeURIComponent(categoryFilter.slug)}`
      : `/games/${game.slug}`,
  }));

  const products = ((productsResult.data || []) as ProductRow[]).map((product) => ({
    ...product,
    href: productHref(product),
  }));

  const categories = ((categoriesResult.data || []) as CategoryRow[]).map((category) => ({
    ...category,
    href: `/games?category=${encodeURIComponent(category.slug)}${rawQuery ? `&q=${encodeURIComponent(rawQuery)}` : ""}`,
  }));

  return NextResponse.json({
    query: rawQuery,
    category: categoryFilter,
    games,
    products,
    categories,
  });
}
