"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { FaBolt, FaGamepad, FaStar, FaTags } from "react-icons/fa";
import { supabase } from "@/lib/supabase";

type GameMaster = {
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
  cover_image_url: string | null;
  background_image: string | null;
  offer_count: number | null;
  is_trending: boolean | null;
  is_featured: boolean | null;
  rating: number | null;
  metacritic: number | null;
};

type ProductSignal = {
  id: number;
  game_category_id: number | null;
  game_name: string | null;
  category: string | null;
  stock: number | string | null;
  status: string | null;
};

type RecentlyViewedProduct = {
  product_id: number;
  viewed_at: string;
  products: {
    game_category_id: number | null;
    game_name: string | null;
    category: string | null;
  } | null;
};

type RecentlyViewedGame = {
  game_id: number | null;
  game_slug: string | null;
  game_name: string | null;
  viewed_at: string;
};

type RecommendedGame = GameMaster & {
  recommended_score: number;
  reason: string;
  active_offer_count: number;
};

function normalize(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function numberValue(value: number | string | null | undefined) {
  const numericValue = Number(value || 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function incrementCounter(counter: Map<string, number>, key: string, amount = 1) {
  if (!key) return;
  counter.set(key, (counter.get(key) || 0) + amount);
}

function fallbackImage(gameName: string) {
  return `https://placehold.co/900x600/020617/22d3ee?text=${encodeURIComponent(
    gameName || "ComePlayers Game"
  )}`;
}

function gameImage(game: GameMaster) {
  return game.cover_image_url || game.background_image || game.image_url || fallbackImage(game.name);
}

export default function RecommendedGames() {
  const [games, setGames] = useState<GameMaster[]>([]);
  const [products, setProducts] = useState<ProductSignal[]>([]);
  const [recentProducts, setRecentProducts] = useState<RecentlyViewedProduct[]>([]);
  const [recentGames, setRecentGames] = useState<RecentlyViewedGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadRecommendedGames() {
      setLoading(true);

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      const baseRequests = [
        supabase
          .from("game_master")
          .select(
            "id,name,slug,image_url,cover_image_url,background_image,offer_count,is_trending,is_featured,rating,metacritic"
          )
          .eq("status", "active")
          .eq("is_active", true)
          .range(0, 4999),
        supabase
          .from("products")
          .select("id,game_category_id,game_name,category,stock,status")
          .eq("status", "active")
          .range(0, 9999),
      ] as const;

      const userRequests = user
        ? ([
            supabase
              .from("recently_viewed")
              .select(
                `
                product_id,
                viewed_at,
                products:product_id (
                  game_category_id,
                  game_name,
                  category
                )
              `
              )
              .eq("user_id", user.id)
              .order("viewed_at", { ascending: false })
              .limit(40),
            supabase
              .from("recently_viewed_games")
              .select("game_id,game_slug,game_name,viewed_at")
              .eq("user_id", user.id)
              .order("viewed_at", { ascending: false })
              .limit(30),
          ] as const)
        : ([] as const);

      const [gamesResult, productsResult, recentProductResult, recentGameResult] =
        await Promise.all([...baseRequests, ...userRequests]);

      if (cancelled) return;

      if (gamesResult.error) {
        console.warn("Failed to load recommended games:", gamesResult.error.message);
        setGames([]);
      } else {
        setGames((gamesResult.data || []) as GameMaster[]);
      }

      if (productsResult.error) {
        console.warn("Failed to load game offer signals:", productsResult.error.message);
        setProducts([]);
      } else {
        setProducts((productsResult.data || []) as ProductSignal[]);
      }

      if (recentProductResult && "error" in recentProductResult && recentProductResult.error) {
        console.warn("Failed to load viewed product game signals:", recentProductResult.error.message);
        setRecentProducts([]);
      } else if (recentProductResult && "data" in recentProductResult) {
        setRecentProducts((recentProductResult.data || []) as unknown as RecentlyViewedProduct[]);
      } else {
        setRecentProducts([]);
      }

      if (recentGameResult && "error" in recentGameResult && recentGameResult.error) {
        console.warn("Failed to load viewed game signals:", recentGameResult.error.message);
        setRecentGames([]);
      } else if (recentGameResult && "data" in recentGameResult) {
        setRecentGames((recentGameResult.data || []) as RecentlyViewedGame[]);
      } else {
        setRecentGames([]);
      }

      setLoading(false);
    }

    loadRecommendedGames();

    return () => {
      cancelled = true;
    };
  }, []);

  const recommendations = useMemo(() => {
    const activeOfferCountByGameId = new Map<number, number>();
    const categorySignalByGameId = new Map<number, Map<string, number>>();
    const gameNameToGameId = new Map<string, number>();
    const viewedGameIds = new Set<number>();
    const viewedGameSlugCounter = new Map<string, number>();
    const viewedGameNameCounter = new Map<string, number>();
    const categoryInterestCounter = new Map<string, number>();

    for (const game of games) {
      gameNameToGameId.set(normalize(game.name), game.id);
    }

    products.forEach((product) => {
      const gameId = Number(product.game_category_id);
      if (!Number.isFinite(gameId) || gameId <= 0) return;
      if (numberValue(product.stock) <= 0) return;

      activeOfferCountByGameId.set(gameId, (activeOfferCountByGameId.get(gameId) || 0) + 1);

      const categoryKey = normalize(product.category);
      if (!categoryKey) return;

      const categoryMap = categorySignalByGameId.get(gameId) || new Map<string, number>();
      categoryMap.set(categoryKey, (categoryMap.get(categoryKey) || 0) + 1);
      categorySignalByGameId.set(gameId, categoryMap);
    });

    recentGames.forEach((game, index) => {
      const weight = Math.max(1, 8 - Math.floor(index / 3));
      const gameId = Number(game.game_id);

      if (Number.isFinite(gameId) && gameId > 0) {
        viewedGameIds.add(gameId);
      }

      incrementCounter(viewedGameSlugCounter, normalize(game.game_slug), weight);
      incrementCounter(viewedGameNameCounter, normalize(game.game_name), weight);
    });

    recentProducts.forEach((row, index) => {
      const product = row.products;
      if (!product) return;

      const weight = Math.max(1, 7 - Math.floor(index / 4));
      const gameId = Number(product.game_category_id);

      if (Number.isFinite(gameId) && gameId > 0) {
        viewedGameIds.add(gameId);
      }

      incrementCounter(viewedGameNameCounter, normalize(product.game_name), weight);
      incrementCounter(categoryInterestCounter, normalize(product.category), weight);
    });

    return games
      .map((game) => {
        const activeOfferCount = activeOfferCountByGameId.get(game.id) || numberValue(game.offer_count);
        const categoryMap = categorySignalByGameId.get(game.id) || new Map<string, number>();
        const categoryMatchScore = Array.from(categoryInterestCounter.entries()).reduce(
          (total, [category, weight]) => total + Math.min(categoryMap.get(category) || 0, 8) * weight * 3,
          0
        );
        const exactGameScore =
          (viewedGameIds.has(game.id) ? 80 : 0) +
          (viewedGameSlugCounter.get(normalize(game.slug)) || 0) * 12 +
          (viewedGameNameCounter.get(normalize(game.name)) || 0) * 12;
        const offerScore = Math.min(activeOfferCount, 40) * 2;
        const featuredScore = game.is_featured ? 25 : 0;
        const trendingScore = game.is_trending ? 18 : 0;
        const ratingScore = numberValue(game.rating) * 3;
        const metacriticScore = numberValue(game.metacritic) / 10;

        const recommendedScore =
          exactGameScore +
          categoryMatchScore +
          offerScore +
          featuredScore +
          trendingScore +
          ratingScore +
          metacriticScore;

        let reason = "Popular marketplace game";
        if (exactGameScore > 0) {
          reason = "Based on games and products you viewed";
        } else if (categoryMatchScore > 0) {
          reason = "Matches your favorite marketplace categories";
        } else if (game.is_featured) {
          reason = "Featured game with active offers";
        } else if (game.is_trending) {
          reason = "Trending across ComePlayers";
        } else if (activeOfferCount > 0) {
          reason = "Active offers available now";
        }

        return {
          ...game,
          active_offer_count: activeOfferCount,
          recommended_score: recommendedScore,
          reason,
        };
      })
      .filter((game) => game.recommended_score > 0)
      .sort((a, b) => {
        return (
          b.recommended_score - a.recommended_score ||
          b.active_offer_count - a.active_offer_count ||
          normalize(a.name).localeCompare(normalize(b.name))
        );
      })
      .slice(0, 8);
  }, [games, products, recentGames, recentProducts]);

  if (loading) return null;
  if (recommendations.length === 0) return null;

  return (
    <section className="px-8 pb-16">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-300">
            <FaGamepad /> Game Recommendations
          </p>

          <h2 className="text-4xl font-black">Recommended Games</h2>

          <p className="mt-2 text-gray-300">
            Personalized from your viewed games, product interests, and active marketplace offers.
          </p>
        </div>

        <Link
          href="/games"
          className="rounded-full border border-emerald-400 px-5 py-3 font-black text-emerald-300 transition hover:bg-emerald-400 hover:text-black"
        >
          Browse All Games
        </Link>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {recommendations.map((game) => {
          const imageUrl = gameImage(game);

          return (
            <Link
              key={game.id}
              href={`/games/${game.slug}`}
              className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.055] shadow-2xl shadow-black/30 backdrop-blur transition hover:-translate-y-1 hover:border-emerald-400 hover:bg-emerald-950/20"
            >
              <div className="relative h-44 bg-black">
                <Image
                  src={imageUrl}
                  alt={game.name}
                  fill
                  className="object-cover transition group-hover:scale-105"
                  unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />

                <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-emerald-400 px-3 py-1 text-xs font-black text-black">
                  <FaBolt /> Recommended
                </span>
              </div>

              <div className="p-5">
                <h3 className="line-clamp-2 text-2xl font-black group-hover:text-emerald-300">
                  {game.name}
                </h3>

                <p className="mt-2 line-clamp-2 text-sm text-gray-400">
                  {game.reason}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                    <p className="text-xs text-gray-500">Offers</p>
                    <p className="mt-1 font-black text-cyan-300">{game.active_offer_count}</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                    <p className="text-xs text-gray-500">Rating</p>
                    <p className="mt-1 inline-flex items-center gap-1 font-black text-yellow-300">
                      <FaStar /> {numberValue(game.rating) || "New"}
                    </p>
                  </div>
                </div>

                <p className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-emerald-300">
                  <FaTags /> Explore marketplace categories
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
