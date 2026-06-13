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

  const products = data || [];
  const sellerIds = Array.from(
    new Set(
      products
        .map((product) => product.seller_id)
        .filter((sellerId): sellerId is string => Boolean(sellerId))
    )
  );

  if (sellerIds.length === 0) {
    return NextResponse.json({ products });
  }

  const [reviewsResult, ordersResult] = await Promise.all([
    supabase
      .from("reviews")
      .select("seller_id,rating")
      .in("seller_id", sellerIds),
    supabase
      .from("orders")
      .select("seller_id,status")
      .in("seller_id", sellerIds),
  ]);

  const sellerStats = new Map<
    string,
    { ratingTotal: number; reviewCount: number; completedOrders: number }
  >();

  for (const sellerId of sellerIds) {
    sellerStats.set(sellerId, {
      ratingTotal: 0,
      reviewCount: 0,
      completedOrders: 0,
    });
  }

  if (!reviewsResult.error) {
    for (const review of reviewsResult.data || []) {
      if (!review.seller_id) continue;

      const stats = sellerStats.get(review.seller_id);
      if (!stats) continue;

      stats.ratingTotal += Number(review.rating || 0);
      stats.reviewCount += 1;
    }
  }

  if (!ordersResult.error) {
    for (const order of ordersResult.data || []) {
      if (!order.seller_id || order.status !== "completed") continue;

      const stats = sellerStats.get(order.seller_id);
      if (!stats) continue;

      stats.completedOrders += 1;
    }
  }

  const enrichedProducts = products.map((product) => {
    const stats = product.seller_id ? sellerStats.get(product.seller_id) : null;
    const sellerRating = stats?.reviewCount
      ? Number((stats.ratingTotal / stats.reviewCount).toFixed(1))
      : null;

    return {
      ...product,
      seller_rating: sellerRating,
      seller_review_count: stats?.reviewCount || 0,
      seller_completed_orders: stats?.completedOrders || 0,
    };
  });

  return NextResponse.json({ products: enrichedProducts });
}