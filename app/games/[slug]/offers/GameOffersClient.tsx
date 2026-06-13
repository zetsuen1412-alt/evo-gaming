"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FaBoxOpen,
  FaFilter,
  FaGamepad,
  FaSearch,
  FaShieldAlt,
  FaShoppingCart,
  FaStar,
  FaStore,
} from "react-icons/fa";

type Game = {
  id: number;
  name: string;
  slug: string;
  background_image?: string | null;
  cover_image_url?: string | null;
  image_url?: string | null;
  offer_count?: number | null;
  rating?: number | null;
};

type Category = {
  id?: string | number;
  name: string;
  slug: string;
};

type Product = {
  id: string | number;
  title: string;
  slug?: string | null;
  price?: string | number | null;
  image_url?: string | null;
  category?: string | null;
  status?: string | null;
  seller_id?: string | null;
  seller_name?: string | null;
  stock?: number | null;
  created_at?: string | null;
  game_name?: string | null;
  game_category_id?: number | null;
};

const FALLBACK_CATEGORIES: Category[] = [
  { name: "All", slug: "all" },
  { name: "Game Accounts", slug: "game-accounts" },
  { name: "Game Coins", slug: "game-coins" },
  { name: "Game Items", slug: "game-items" },
  { name: "Boosting", slug: "boosting" },
  { name: "Top Up", slug: "top-up" },
  { name: "Gift Cards", slug: "gift-cards" },
];

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeCategory(value: string | null, categories: Category[]) {
  if (!value) return "All";

  const decodedValue = decodeURIComponent(value).trim().toLowerCase();
  const matchedCategory = categories.find(
    (item) =>
      item.name.toLowerCase() === decodedValue ||
      item.slug.toLowerCase() === decodedValue
  );

  return matchedCategory?.name || "All";
}

function categorySlug(value: string | null | undefined, categories: Category[]) {
  if (!value) return "all";

  const decodedValue = decodeURIComponent(value).trim().toLowerCase();
  const matchedCategory = categories.find(
    (item) =>
      item.name.toLowerCase() === decodedValue ||
      item.slug.toLowerCase() === decodedValue
  );

  return matchedCategory?.slug || toSlug(decodedValue);
}

function mergeCategories(categories: Category[]) {
  const merged = new Map<string, Category>();

  for (const item of [...FALLBACK_CATEGORIES, ...categories]) {
    const slug = item.slug || toSlug(item.name);
    if (!slug) continue;
    merged.set(slug, { ...item, slug });
  }

  return Array.from(merged.values());
}

const SORTS = [
  { label: "Newest", value: "newest" },
  { label: "Price: Low to High", value: "price_asc" },
  { label: "Price: High to Low", value: "price_desc" },
];

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function numberPrice(value: string | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;

  const cleaned = value.replace(/[^\d]/g, "");
  return Number(cleaned || 0);
}

function formatPrice(value: string | number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(numberPrice(value));
}

function gameImage(game: Game) {
  return (
    game.background_image ||
    game.cover_image_url ||
    game.image_url ||
    `https://placehold.co/1400x800/020617/22d3ee?text=${encodeURIComponent(
      game.name
    )}`
  );
}

function productUrl(product: Product) {
  return `/product/${product.slug || product.id}`;
}

function sellerCreateUrl(gameSlug: string, categoryName: string) {
  const params = new URLSearchParams({ game: gameSlug });

  if (categoryName !== "All") {
    params.set("category", categoryName);
  }

  return `/seller/products/new?${params.toString()}`;
}

export default function GameOffersClient({ game }: { game: Game }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [categories, setCategories] = useState<Category[]>(FALLBACK_CATEGORIES);
  const safeInitialCategory = normalizeCategory(searchParams.get("category"), categories);

  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(safeInitialCategory);
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(true);

  const gameName = titleCase(game.name);
  const heroImage = gameImage(game);

  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await fetch("/api/game-categories", { cache: "no-store" });
        const json = await res.json();
        const remoteCategories = Array.isArray(json.categories)
          ? json.categories
              .filter((item: Category) => item?.name)
              .map((item: Category) => ({
                id: item.id,
                name: item.name,
                slug: item.slug || toSlug(item.name),
              }))
          : [];

        setCategories(mergeCategories(remoteCategories));
      } catch (error) {
        console.error("Load offer categories failed:", error);
        setCategories(FALLBACK_CATEGORIES);
      }
    }

    loadCategories();
  }, []);

  useEffect(() => {
    setCategory(normalizeCategory(searchParams.get("category"), categories));
  }, [searchParams, categories]);

  function handleCategoryChange(nextCategory: string) {
    setCategory(nextCategory);

    const params = new URLSearchParams(searchParams.toString());

    if (nextCategory === "All") {
      params.delete("category");
    } else {
      params.set("category", nextCategory);
    }

    const queryString = params.toString();
    router.replace(
      queryString
        ? `/games/${game.slug}/offers?${queryString}`
        : `/games/${game.slug}/offers`,
      { scroll: false }
    );
  }

  useEffect(() => {
    async function loadProducts() {
      setLoading(true);

      try {
        const params = new URLSearchParams({
          game: game.slug,
          limit: "100",
        });

        if (category !== "All") {
          params.set("category", category);
        }

        const res = await fetch(`/api/products/by-game?${params.toString()}`, {
          cache: "no-store",
        });

        const json = await res.json();
        setProducts(json.products || []);
      } catch (error) {
        console.error("Load game offers failed:", error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, [game.slug, category]);

  const filteredProducts = useMemo(() => {
    let list = [...products];

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((item) =>
        `${item.title} ${item.category || ""} ${item.seller_name || ""}`
          .toLowerCase()
          .includes(q)
      );
    }

    if (category !== "All") {
      const selectedCategorySlug = categorySlug(category, categories);
      list = list.filter(
        (item) => categorySlug(item.category, categories) === selectedCategorySlug
      );
    }

    if (sort === "price_asc") {
      list.sort((a, b) => numberPrice(a.price) - numberPrice(b.price));
    }

    if (sort === "price_desc") {
      list.sort((a, b) => numberPrice(b.price) - numberPrice(a.price));
    }

    if (sort === "newest") {
      list.sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
      );
    }

    return list;
  }, [products, query, category, sort, categories]);

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <section
        className="relative border-b border-cyan-400/20 bg-cover bg-center"
        style={{
          backgroundImage: `
            linear-gradient(90deg, rgba(2,6,23,.98), rgba(2,6,23,.82), rgba(2,6,23,.55)),
            url(${heroImage})
          `,
        }}
      >
        <div className="absolute inset-0 bg-black/25 backdrop-blur-[1px]" />

        <div className="relative mx-auto max-w-7xl px-4 py-16">
          <Link
            href={`/games/${game.slug}`}
            className="text-sm font-black text-cyan-300 hover:underline"
          >
            ← Back to {gameName}
          </Link>

          <h1 className="mt-8 text-5xl font-black md:text-7xl">
            {gameName} Offers
          </h1>

          <p className="mt-4 max-w-2xl text-slate-200">
            Browse trusted {gameName} accounts, coins, items, boosting, top-up,
            and digital services.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-200">
              {game.offer_count || products.length} offers
            </span>

            <span className="inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-sm font-black text-yellow-300">
              <FaStar /> {game.rating ? Number(game.rating).toFixed(1) : "-"}
            </span>

            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-300">
              <FaShieldAlt /> Secure Trading
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_220px_220px]">
            <div className="relative">
              <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${gameName} offers...`}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-11 py-4 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
              />
            </div>

            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="rounded-xl border border-white/10 bg-black/40 px-4 py-4 text-white outline-none focus:border-cyan-400"
            >
              {categories.map((item) => (
                <option key={item.slug} value={item.name} className="bg-[#050816]">
                  {item.name}
                </option>
              ))}
            </select>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-xl border border-white/10 bg-black/40 px-4 py-4 text-white outline-none focus:border-cyan-400"
            >
              {SORTS.map((item) => (
                <option
                  key={item.value}
                  value={item.value}
                  className="bg-[#050816]"
                >
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-5 flex items-center gap-2 text-sm text-slate-400">
            <FaFilter className="text-cyan-300" />
            Showing {filteredProducts.length} of {products.length} offers
          </div>
        </div>

        <div className="mt-8">
          {loading ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-10 text-center text-slate-400">
              Loading offers...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-10 text-center">
              <h2 className="text-2xl font-black">No offers found</h2>
              <p className="mt-2 text-slate-400">
                Be the first seller to create an offer for {gameName}.
              </p>

              <Link
                href={sellerCreateUrl(game.slug, category)}
                className="mt-6 inline-block rounded-xl bg-cyan-400 px-6 py-3 font-black text-black"
              >
                Create Offer
              </Link>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {filteredProducts.map((product) => (
                <Link
                  key={product.id}
                  href={productUrl(product)}
                  className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] transition hover:-translate-y-1 hover:border-cyan-400 hover:bg-cyan-400/5"
                >
                  <div
                    className="relative h-40 overflow-hidden bg-cover bg-center"
                    style={{
                      backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,.88)), url(${
                        product.image_url || heroImage
                      })`,
                    }}
                  >
                    <div className="absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1 text-xs font-black text-cyan-300">
                      {product.category || "Game Product"}
                    </div>

                    {product.stock !== null && product.stock !== undefined ? (
                      <div className="absolute right-4 top-4 rounded-full bg-emerald-400/90 px-3 py-1 text-xs font-black text-black">
                        Stock {product.stock}
                      </div>
                    ) : null}
                  </div>

                  <div className="p-5">
                    <p className="line-clamp-2 min-h-[48px] font-black text-white">
                      {product.title}
                    </p>

                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                      <FaStore className="text-cyan-300" />
                      <span>{product.seller_name || "Verified Seller"}</span>
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-xs text-emerald-300">
                      <FaShieldAlt />
                      <span>Secure escrow transaction</span>
                    </div>

                    <p className="mt-4 text-2xl font-black text-cyan-300">
                      {formatPrice(product.price)}
                    </p>

                    <div className="mt-5 flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                      <span className="inline-flex items-center gap-2 text-sm font-black text-white">
                        <FaShoppingCart className="text-cyan-300" />
                        View Details
                      </span>

                      <span className="text-cyan-300">→</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="mt-10 rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-cyan-200">
                Want to sell {gameName}?
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                Create your offer and start selling safely on ComePlayers.
              </p>
            </div>

            <Link
              href={sellerCreateUrl(game.slug, category)}
              className="rounded-xl bg-cyan-400 px-6 py-3 text-center font-black text-black hover:bg-cyan-300"
            >
              Create Offer
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}