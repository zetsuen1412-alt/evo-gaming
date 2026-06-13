"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FaFilter, FaSearch, FaStar } from "react-icons/fa";

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

type Product = {
  id: string;
  title: string;
  slug?: string | null;
  price?: number | null;
  image_url?: string | null;
  category?: string | null;
  status?: string | null;
  seller_id?: string | null;
  created_at?: string | null;
};

const CATEGORIES = [
  "All",
  "Game Accounts",
  "Game Coins",
  "Game Items",
  "Boosting",
  "Top Up",
  "Gift Cards",
];

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

function formatPrice(value: number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
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

export default function GameOffersClient({ game }: { game: Game }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(true);

  const gameName = titleCase(game.name);
  const heroImage = gameImage(game);

  useEffect(() => {
    async function loadProducts() {
      setLoading(true);

      const params = new URLSearchParams({
        game: game.slug,
        limit: "100",
      });

      const res = await fetch(`/api/products/by-game?${params.toString()}`);
      const json = await res.json();

      setProducts(json.products || []);
      setLoading(false);
    }

    loadProducts();
  }, [game.slug]);

  const filteredProducts = useMemo(() => {
    let list = [...products];

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((item) =>
        `${item.title} ${item.category || ""}`.toLowerCase().includes(q)
      );
    }

    if (category !== "All") {
      list = list.filter((item) => item.category === category);
    }

    if (sort === "price_asc") {
      list.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    }

    if (sort === "price_desc") {
      list.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    }

    if (sort === "newest") {
      list.sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
      );
    }

    return list;
  }, [products, query, category, sort]);

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
          <Link href={`/games/${game.slug}`} className="text-sm font-black text-cyan-300">
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
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-xl border border-white/10 bg-black/40 px-4 py-4 text-white outline-none focus:border-cyan-400"
            >
              {CATEGORIES.map((item) => (
                <option key={item} value={item} className="bg-[#050816]">
                  {item}
                </option>
              ))}
            </select>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-xl border border-white/10 bg-black/40 px-4 py-4 text-white outline-none focus:border-cyan-400"
            >
              {SORTS.map((item) => (
                <option key={item.value} value={item.value} className="bg-[#050816]">
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
                href={`/seller/products/new?game=${game.slug}`}
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
                  href={`/product/${product.slug || product.id}`}
                  className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] transition hover:-translate-y-1 hover:border-cyan-400"
                >
                  <div
                    className="h-40 bg-cover bg-center transition group-hover:scale-105"
                    style={{
                      backgroundImage: `linear-gradient(180deg, transparent, rgba(0,0,0,.8)), url(${
                        product.image_url || heroImage
                      })`,
                    }}
                  />

                  <div className="p-5">
                    <p className="line-clamp-2 min-h-[48px] font-black text-white">
                      {product.title}
                    </p>

                    <p className="mt-3 text-xl font-black text-cyan-300">
                      {formatPrice(product.price)}
                    </p>

                    <div className="mt-4 flex items-center justify-between">
                      <span className="rounded-lg bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-200">
                        {product.category || "Game Product"}
                      </span>

                      <span className="text-xs font-bold text-slate-400">
                        View →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}