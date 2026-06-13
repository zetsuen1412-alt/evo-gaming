"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GameCard from "@/components/games/GameCard";
import MarketplaceSearch from "@/components/marketplace/MarketplaceSearch";

type Game = {
  id: number;
  name: string;
  slug: string;
  first_letter: string;
  image_url: string | null;
  cover_image_url: string | null;
  background_image: string | null;
  offer_count: number;
  is_trending: boolean;
  is_featured: boolean;
  rating: number;
  metacritic: number | null;
};

type Category = {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
};

function normalizeCategoryValue(value: string) {
  return decodeURIComponent(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function gameHref(gameSlug: string, activeCategory: Category | null) {
  if (!activeCategory) return `/games/${gameSlug}`;

  const params = new URLSearchParams({
    category: activeCategory.name,
  });

  return `/games/${gameSlug}/offers?${params.toString()}`;
}

const LETTERS = [
  "All",
  "0-9",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
];

export default function BrowseGamesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialQuery = searchParams.get("q") || "";
  const initialLetter = searchParams.get("letter") || "";
  const initialCategory = searchParams.get("category") || "";

  const [games, setGames] = useState<Game[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState(initialQuery);
  const [letter, setLetter] = useState(initialLetter);
  const [category, setCategory] = useState(initialCategory);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const activeCategory = useMemo(() => {
    const normalizedCategory = normalizeCategoryValue(category);

    return (
      categories.find((item) => {
        return (
          normalizeCategoryValue(item.slug) === normalizedCategory ||
          normalizeCategoryValue(item.name) === normalizedCategory
        );
      }) || null
    );
  }, [categories, category]);

  function syncUrl(nextQuery: string, nextLetter: string, nextCategory: string) {
    const params = new URLSearchParams();

    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (nextLetter && nextLetter !== "All") params.set("letter", nextLetter);
    if (nextCategory) params.set("category", nextCategory);

    const nextUrl = params.toString() ? `/games?${params.toString()}` : "/games";
    router.replace(nextUrl, { scroll: false });
  }

  async function loadCategories() {
    try {
      const res = await fetch("/api/game-categories");
      const json = await res.json();

      if (!res.ok) {
        console.error("Load game categories error:", json.error || res.statusText);
        setCategories([]);
        return;
      }

      setCategories(json.categories || []);
    } catch (error) {
      console.error("Load game categories error:", error);
      setCategories([]);
    }
  }

  async function loadGames(
    nextPage = 1,
    nextQuery = query,
    nextLetter = letter,
    nextCategory = category
  ) {
    setLoading(true);

    const params = new URLSearchParams({
      page: String(nextPage),
      limit: "48",
    });

    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (nextLetter && nextLetter !== "All") params.set("letter", nextLetter);
    if (nextCategory) params.set("category", nextCategory);

    const res = await fetch(`/api/games?${params.toString()}`);
    const json = await res.json();

    setGames(json.games || []);
    setCount(json.count || 0);
    setPage(nextPage);
    setLoading(false);
  }

  useEffect(() => {
    loadCategories();
    loadGames(1, initialQuery, initialLetter, initialCategory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!category || categories.length === 0) return;

    if (!activeCategory) {
      setCategory("");
      syncUrl(query, letter, "");
      loadGames(1, query, letter, "");
      return;
    }

    if (category !== activeCategory.slug) {
      setCategory(activeCategory.slug);
      syncUrl(query, letter, activeCategory.slug);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, activeCategory, category]);

  const totalPages = Math.max(Math.ceil(count / 48), 1);

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,#155e75,transparent_35%),linear-gradient(180deg,#08111f,#050816)] px-4 py-14">
        <div className="mx-auto max-w-7xl">
          <p className="w-fit rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
            🎮 ComePlayers Game Catalog
          </p>

          <h1 className="mt-5 text-4xl font-black leading-tight md:text-6xl">
            Browse Games A–Z
          </h1>

          <p className="mt-4 max-w-2xl text-slate-300">
            Search game accounts, coins, items, boosting, and top-up services from
            one unified game catalog.
          </p>

          <div className="mt-8 max-w-2xl">
            <MarketplaceSearch
              categories={categories}
              initialQuery={query}
              initialCategory={category}
              placeholder="Search games, products, categories..."
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-black">
              {activeCategory ? `${activeCategory.name} Games` : "All Games"}
            </h2>
            <p className="mt-1 text-slate-400">
              {count.toLocaleString("id-ID")} games found
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              syncUrl(query, letter, category);
              loadGames(1, query, letter, category);
            }}
            className="flex gap-3"
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter games..."
              className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
            />

            <button className="rounded-xl bg-cyan-400 px-5 py-3 font-black text-black transition hover:bg-cyan-300">
              Search
            </button>
          </form>
        </div>

        <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <p className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-slate-400">
            Marketplace Categories
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setCategory("");
                syncUrl(query, letter, "");
                loadGames(1, query, letter, "");
              }}
              className={`rounded-full border px-4 py-2 text-sm font-black transition ${
                !category
                  ? "border-cyan-400 bg-cyan-400 text-black"
                  : "border-white/10 bg-black/30 text-slate-300 hover:border-cyan-400"
              }`}
            >
              All
            </button>

            {categories.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setCategory(item.slug);
                  syncUrl(query, letter, item.slug);
                  loadGames(1, query, letter, item.slug);
                }}
                className={`rounded-full border px-4 py-2 text-sm font-black transition ${
                  activeCategory?.id === item.id
                    ? "border-cyan-400 bg-cyan-400 text-black"
                    : "border-white/10 bg-black/30 text-slate-300 hover:border-cyan-400"
                }`}
              >
                {item.icon ? `${item.icon} ` : ""}
                {item.name}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-8 flex flex-wrap gap-2">
          {LETTERS.map((item) => {
            const active = item === "All" ? !letter : letter === item;

            return (
              <button
                key={item}
                type="button"
                onClick={() => {
                  const nextLetter = item === "All" ? "" : item;
                  setLetter(nextLetter);
                  syncUrl(query, nextLetter, category);
                  loadGames(1, query, nextLetter, category);
                }}
                className={`rounded-lg border px-3 py-2 text-sm font-bold transition ${
                  active
                    ? "border-cyan-400 bg-cyan-400 text-black"
                    : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-400"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-10 text-center text-slate-400">
            Loading games...
          </div>
        ) : games.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-10 text-center text-slate-400">
            No games found.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {games.map((game) => (
              <GameCard key={game.id} game={game} href={gameHref(game.slug, activeCategory)} />
            ))}
          </div>
        )}

        <div className="mt-10 flex items-center justify-center gap-3">
          <button
            disabled={page <= 1}
            onClick={() => loadGames(page - 1, query, letter, category)}
            className="rounded-xl border border-white/10 px-5 py-3 font-bold text-white transition hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>

          <span className="text-sm text-slate-400">
            Page {page} / {totalPages}
          </span>

          <button
            disabled={page >= totalPages}
            onClick={() => loadGames(page + 1, query, letter, category)}
            className="rounded-xl border border-white/10 px-5 py-3 font-bold text-white transition hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </section>
    </main>
  );
}
