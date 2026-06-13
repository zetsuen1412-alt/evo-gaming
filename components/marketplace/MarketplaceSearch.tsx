"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SearchCategory = {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  href?: string;
};

type SearchGame = {
  id: number;
  name: string;
  slug: string;
  offer_count: number | null;
  is_trending: boolean | null;
  rating: number | null;
  href: string;
};

type SearchProduct = {
  id: number;
  title: string;
  slug: string | null;
  price: number | string | null;
  image_url: string | null;
  category: string | null;
  game_name: string | null;
  seller_name: string | null;
  href: string;
};

type SearchResponse = {
  games: SearchGame[];
  products: SearchProduct[];
  categories: SearchCategory[];
};

type MarketplaceSearchProps = {
  categories?: SearchCategory[];
  initialQuery?: string;
  initialCategory?: string;
  placeholder?: string;
  compact?: boolean;
};

function formatPrice(value: string | number | null | undefined) {
  const amount = Number(String(value ?? 0).replace(/[^\d]/g, "") || 0);

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function MarketplaceSearch({
  categories = [],
  initialQuery = "",
  initialCategory = "",
  placeholder = "Search games, products, categories...",
  compact = false,
}: MarketplaceSearchProps) {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [results, setResults] = useState<SearchResponse>({
    games: [],
    products: [],
    categories: [],
  });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const hasResults =
    results.games.length > 0 ||
    results.products.length > 0 ||
    results.categories.length > 0;

  function searchHref() {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (selectedCategory) params.set("category", selectedCategory);
    const qs = params.toString();
    return qs ? `/search?${qs}` : "/search";
  }

  function submitSearch() {
    setOpen(false);
    router.push(searchHref());
  }

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      if (query.trim().length < 2 && selectedCategory.length < 2) {
        setResults({ games: [], products: [], categories: [] });
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const params = new URLSearchParams({ q: query.trim(), limit: "6" });
        if (selectedCategory) params.set("category", selectedCategory);

        const response = await fetch(`/api/marketplace/search?${params.toString()}`);
        const json = await response.json();

        if (!response.ok) {
          console.error("Marketplace search error:", json.error || response.statusText);
          setResults({ games: [], products: [], categories: [] });
          return;
        }

        setResults({
          games: json.games || [],
          products: json.products || [],
          categories: json.categories || [],
        });
        setOpen(true);
      } catch (error) {
        console.error("Marketplace search error:", error);
        setResults({ games: [], products: [], categories: [] });
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query, selectedCategory]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div
        className={
          compact
            ? "flex min-w-[320px] flex-1 items-center rounded-full border border-slate-700 bg-[#111827] shadow-xl shadow-black/20 focus-within:border-cyan-400"
            : "flex w-full items-center rounded-2xl border border-cyan-400/30 bg-black/50 shadow-xl shadow-black/30 focus-within:border-cyan-400"
        }
      >
        {categories.length > 0 ? (
          <select
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
            className={
              compact
                ? "w-44 rounded-l-full border-r border-slate-700 bg-[#020617] px-4 py-3 text-sm font-bold text-white outline-none"
                : "w-48 rounded-l-2xl border-r border-slate-700 bg-[#020617] px-4 py-4 text-sm font-bold text-white outline-none"
            }
          >
            <option value="">All Categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        ) : null}

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submitSearch();
          }}
          placeholder={placeholder}
          className={
            compact
              ? "w-full bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-gray-400"
              : "w-full bg-transparent px-5 py-4 text-white outline-none placeholder:text-slate-500"
          }
        />

        <button
          type="button"
          onClick={submitSearch}
          className={
            compact
              ? "mr-2 shrink-0 rounded-full bg-cyan-400 px-5 py-2 font-black text-black transition hover:bg-cyan-300"
              : "mr-2 shrink-0 rounded-xl bg-cyan-400 px-6 py-3 font-black text-black transition hover:bg-cyan-300"
          }
        >
          Search
        </button>
      </div>

      {open && (query.trim().length >= 2 || selectedCategory) ? (
        <div className="absolute left-0 right-0 top-full z-[9999] mt-3 overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220] shadow-2xl shadow-black">
          {loading ? (
            <div className="p-5 text-sm text-slate-400">Searching marketplace...</div>
          ) : hasResults ? (
            <div className="max-h-[70vh] overflow-y-auto">
              {results.games.length > 0 ? (
                <div className="border-b border-white/10 p-3">
                  <p className="px-2 pb-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                    Games
                  </p>
                  {results.games.map((game) => (
                    <Link
                      key={`game-${game.id}`}
                      href={game.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 transition hover:bg-white/10"
                    >
                      <div>
                        <p className="font-bold text-white">{game.name}</p>
                        <p className="text-xs text-slate-400">
                          {game.offer_count || 0} offers
                          {game.rating ? ` • ★ ${Number(game.rating).toFixed(1)}` : ""}
                        </p>
                      </div>
                      {game.is_trending ? (
                        <span className="rounded-full bg-yellow-400 px-2 py-1 text-xs font-black text-black">
                          HOT
                        </span>
                      ) : null}
                    </Link>
                  ))}
                </div>
              ) : null}

              {results.products.length > 0 ? (
                <div className="border-b border-white/10 p-3">
                  <p className="px-2 pb-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
                    Products
                  </p>
                  {results.products.map((product) => (
                    <Link
                      key={`product-${product.id}`}
                      href={product.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 transition hover:bg-white/10"
                    >
                      <div className="min-w-0">
                        <p className="line-clamp-1 font-bold text-white">{product.title}</p>
                        <p className="line-clamp-1 text-xs text-slate-400">
                          {product.game_name || "Game"}
                          {product.category ? ` • ${product.category}` : ""}
                          {product.seller_name ? ` • ${product.seller_name}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-black text-cyan-300">
                        {formatPrice(product.price)}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : null}

              {results.categories.length > 0 ? (
                <div className="p-3">
                  <p className="px-2 pb-2 text-xs font-black uppercase tracking-[0.2em] text-purple-300">
                    Categories
                  </p>
                  <div className="flex flex-wrap gap-2 px-2 pb-1">
                    {results.categories.map((category) => (
                      <Link
                        key={`category-${category.id}`}
                        href={category.href || `/games?category=${category.slug}`}
                        onClick={() => setOpen(false)}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-slate-200 transition hover:border-cyan-400"
                      >
                        {category.icon ? `${category.icon} ` : ""}
                        {category.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="border-t border-white/10 p-3">
                <Link
                  href={searchHref()}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl bg-cyan-400 px-4 py-3 text-center font-black text-black transition hover:bg-cyan-300"
                >
                  View all results
                </Link>
              </div>
            </div>
          ) : (
            <div className="p-5 text-sm text-slate-400">No marketplace results found.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
