"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Category = {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
};

type GameMaster = {
  id: number;
  name: string;
  slug: string;
  first_letter: string | null;
  status: string | null;
  image_url: string | null;
  icon_url: string | null;
  logo_url: string | null;
  banner_url: string | null;
  mobile_banner_url: string | null;
  background_url: string | null;
  hero_url: string | null;
  description: string | null;
};

type CategoryGameMasterRow = {
  id: number;
  category_id: number;
  game_master_id: number;
  status: string | null;
  sort_order: number | null;
  game_master: GameMaster | null;
};

type Product = {
  id: number;
  title: string;
  description: string | null;
  price: string | number | null;
  stock: number | null;
  image_url: string | null;
  seller: string | null;
  seller_id: string | null;
  seller_name: string | null;
  category: string | null;
  category_id: number | null;
  game_name: string | null;
  game_category_id: number | null;
  status: string | null;
  created_at: string;
};

function formatPrice(value: string | number | null) {
  const numberValue = Number(value || 0);
  if (!Number.isFinite(numberValue)) return "Rp 0";
  return `Rp ${numberValue.toLocaleString("id-ID")}`;
}

function removeCategorySuffix(gameParam: string, categorySlug: string) {
  const suffix = `-${categorySlug}`;
  if (gameParam.endsWith(suffix)) return gameParam.slice(0, -suffix.length);
  return gameParam;
}

export default function GameDetailPageV2() {
  const params = useParams();

  const categorySlug = String(params.slug || "");
  const gameParam = String(params.game || "");

  const gameSlug = useMemo(() => {
    return removeCategorySuffix(gameParam, categorySlug);
  }, [gameParam, categorySlug]);

  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<Category | null>(null);
  const [game, setGame] = useState<GameMaster | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState("latest");

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = products.filter((product) => {
      if (!query) return true;

      return (
        product.title.toLowerCase().includes(query) ||
        (product.description || "").toLowerCase().includes(query) ||
        (product.seller_name || "").toLowerCase().includes(query) ||
        (product.seller || "").toLowerCase().includes(query)
      );
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === "price_low") {
        return Number(a.price || 0) - Number(b.price || 0);
      }

      if (sortMode === "price_high") {
        return Number(b.price || 0) - Number(a.price || 0);
      }

      if (sortMode === "stock_high") {
        return Number(b.stock || 0) - Number(a.stock || 0);
      }

      return (
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
      );
    });
  }, [products, search, sortMode]);

  useEffect(() => {
    if (categorySlug && gameSlug) {
      loadPage();
    }
  }, [categorySlug, gameSlug]);

  async function loadPage() {
    setLoading(true);

    const { data: categoryData, error: categoryError } = await supabase
      .from("categories")
      .select("*")
      .eq("slug", categorySlug)
      .maybeSingle();

    if (categoryError) {
      alert(categoryError.message);
      setLoading(false);
      return;
    }

    if (!categoryData) {
      setCategory(null);
      setGame(null);
      setLoading(false);
      return;
    }

    setCategory(categoryData);

    const { data: mappingData, error: mappingError } = await supabase
      .from("category_game_master")
      .select(
        `
        id,
        category_id,
        game_master_id,
        status,
        sort_order,
        game_master:game_master_id (
          id,
          name,
          slug,
          first_letter,
          status,
          image_url,
          icon_url,
          logo_url,
          banner_url,
          mobile_banner_url,
          background_url,
          hero_url,
          description
        )
      `
      )
      .eq("category_id", categoryData.id)
      .eq("status", "active");

    if (mappingError) {
      alert(mappingError.message);
      setLoading(false);
      return;
    }

    const mappedRows = (mappingData || []) as unknown as CategoryGameMasterRow[];

    const matchedGame =
      mappedRows
        .map((row) => row.game_master)
        .find((item) => item?.slug === gameSlug && item.status === "active") ||
      null;

    if (!matchedGame) {
      setGame(null);
      setProducts([]);
      setLoading(false);
      return;
    }

    setGame(matchedGame);

    const { data: productData, error: productError } = await supabase
      .from("products")
      .select("*")
      .eq("category_id", categoryData.id)
      .eq("game_category_id", matchedGame.id)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (productError) {
      alert(productError.message);
      setLoading(false);
      return;
    }

    setProducts(productData || []);
    setLoading(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <p className="text-xl font-black text-cyan-300">Loading products...</p>
      </main>
    );
  }

  if (!category || !game) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
        <div className="max-w-lg rounded-3xl border border-red-400/20 bg-red-400/10 p-8 text-center">
          <h1 className="text-3xl font-black text-red-300">Game not found</h1>

          <p className="mt-3 text-gray-300">
            This game is not mapped to the selected category yet.
          </p>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4 text-left text-sm text-gray-300">
            <p>Category: {categorySlug}</p>
            <p>Game URL: {gameParam}</p>
            <p>Detected Game Slug: {gameSlug}</p>
          </div>

          <Link
            href={`/categories/${categorySlug}`}
            className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-cyan-400 px-6 font-black text-black hover:bg-cyan-300"
          >
            Back to Category
          </Link>
        </div>
      </main>
    );
  }

  const heroImage =
    game.hero_url ||
    game.banner_url ||
    game.background_url ||
    game.image_url ||
    null;

  const logoImage = game.logo_url || game.icon_url || game.image_url || null;

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <section className="relative overflow-hidden border-b border-white/10">
        {heroImage && (
          <div className="absolute inset-0">
            <img
              src={heroImage}
              alt={game.name}
              className="h-full w-full object-cover opacity-35"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#020617] via-[#020617]/85 to-[#020617]/60" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-[#020617]/40" />
          </div>
        )}

        {!heroImage && (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.20),transparent_32%),radial-gradient(circle_at_top_right,rgba(37,99,235,.18),transparent_34%)]" />
        )}

        <div className="relative z-10 mx-auto grid max-w-7xl gap-8 px-8 py-14 lg:grid-cols-[1fr_360px] lg:items-center">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
              {category.icon ? `${category.icon} ` : ""}
              {category.name} Marketplace
            </p>

            {logoImage && (
              <div className="mb-6 flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border border-cyan-400/30 bg-black/40">
                <img
                  src={logoImage}
                  alt={`${game.name} logo`}
                  className="h-full w-full object-contain p-3"
                />
              </div>
            )}

            <h1 className="text-5xl font-black md:text-7xl">{game.name}</h1>

            <p className="mt-5 max-w-3xl text-gray-300">
              {game.description ||
                `Browse active seller listings for ${game.name} under ${category.name}. Buy safely through ComePlayers secure order flow.`}
            </p>

            <div className="mt-7 flex flex-wrap gap-3 text-sm font-bold">
              <span className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-cyan-300">
                Secure Transactions
              </span>

              <span className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-cyan-300">
                Verified Seller Flow
              </span>

              <span className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-cyan-300">
                {products.length} Active Listings
              </span>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-cyan-400/20 bg-white/[0.035] p-5 shadow-2xl shadow-cyan-500/10 backdrop-blur">
            <div className="flex h-60 items-center justify-center rounded-2xl bg-black/50">
              {game.image_url || game.icon_url || game.logo_url ? (
                <img
                  src={game.image_url || game.icon_url || game.logo_url || ""}
                  alt={game.name}
                  className="h-full w-full rounded-2xl object-cover"
                />
              ) : (
                <span className="text-7xl">🎮</span>
              )}
            </div>

            <h2 className="mt-5 text-center text-2xl font-black">
              {game.name}
            </h2>

            <p className="mt-2 text-center text-sm text-gray-400">
              {category.name}
            </p>
          </div>
        </div>
      </section>

      {game.mobile_banner_url && (
        <section className="px-8 pt-8 lg:hidden">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-3xl border border-cyan-400/20">
            <img
              src={game.mobile_banner_url}
              alt={`${game.name} mobile banner`}
              className="w-full object-cover"
            />
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-8 py-10">
        <div className="mb-8 rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/30">
          <div className="grid gap-4 lg:grid-cols-[1fr_260px_180px]">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${game.name} products...`}
              className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none placeholder:text-gray-500 focus:border-cyan-400"
            />

            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value)}
              className="rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none focus:border-cyan-400"
            >
              <option value="latest">Latest</option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
              <option value="stock_high">Highest Stock</option>
            </select>

            <Link
              href={`/categories/${category.slug}`}
              className="inline-flex h-14 items-center justify-center rounded-2xl border border-cyan-400 px-5 font-black text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
            >
              Back
            </Link>
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-12 text-center shadow-2xl shadow-black/30">
            <h2 className="text-3xl font-black">No Products Yet</h2>

            <p className="mt-3 text-gray-400">
              No active seller listings are available for this game and category
              yet.
            </p>

            <Link
              href="/seller/products/new"
              className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-cyan-400 px-6 font-black text-black hover:bg-cyan-300"
            >
              Sell This Game
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {filteredProducts.map((product) => (
              <Link
                key={product.id}
                href={`/product/${product.id}`}
                className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] transition hover:-translate-y-1 hover:border-cyan-400 hover:bg-cyan-400/10"
              >
                <div className="flex h-52 items-center justify-center bg-black">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.title}
                      className="h-full w-full object-cover"
                    />
                  ) : logoImage ? (
                    <img
                      src={logoImage}
                      alt={game.name}
                      className="h-full w-full object-contain p-8"
                    />
                  ) : (
                    <span className="text-6xl">🎮</span>
                  )}
                </div>

                <div className="p-5">
                  <h3 className="line-clamp-2 text-xl font-black group-hover:text-cyan-300">
                    {product.title}
                  </h3>

                  <p className="mt-3 text-2xl font-black text-cyan-300">
                    {formatPrice(product.price)}
                  </p>

                  <p className="mt-2 text-sm text-gray-400">
                    Seller:{" "}
                    {product.seller_name || product.seller || "Unknown Seller"}
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    Stock: {product.stock || 0}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}