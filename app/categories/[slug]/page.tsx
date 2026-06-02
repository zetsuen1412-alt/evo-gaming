"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
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
};

type CategoryGameMasterRow = {
  id: number;
  category_id: number;
  game_master_id: number;
  status: string | null;
  sort_order: number | null;
  game_master: GameMaster | null;
};

const categoryBannerMap: Record<string, string> = {
  "game-accounts": "/category-banners/game-accounts.png",
  "game-coins": "/category-banners/game-coins.png",
  "game-items": "/category-banners/game-items.png",
  "top-up": "/category-banners/top-up.png",
  "gift-cards": "/category-banners/gift-cards.png",
  boosting: "/category-banners/boosting.png",
  skins: "/category-banners/skins.png",
  software: "/category-banners/software.png",
};

export default function CategoryPage() {
  const params = useParams();
  const slug = String(params.slug || "");

  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<Category | null>(null);
  const [games, setGames] = useState<GameMaster[]>([]);
  const [search, setSearch] = useState("");
  const [activeLetter, setActiveLetter] = useState("all");

  const bannerImage = useMemo(() => {
    return categoryBannerMap[slug] || null;
  }, [slug]);

  const letters = useMemo(() => {
    const uniqueLetters = Array.from(
      new Set(
        games
          .map((game) => (game.first_letter || game.name.charAt(0)).toUpperCase())
          .filter(Boolean)
      )
    );

    return uniqueLetters.sort();
  }, [games]);

  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      const gameLetter = (game.first_letter || game.name.charAt(0)).toUpperCase();

      const matchesLetter = activeLetter === "all" || gameLetter === activeLetter;

      const matchesSearch = game.name
        .toLowerCase()
        .includes(search.trim().toLowerCase());

      return matchesLetter && matchesSearch;
    });
  }, [games, search, activeLetter]);

  useEffect(() => {
    if (slug) loadCategory();
  }, [slug]);

  async function loadCategory() {
    setLoading(true);

    const { data: categoryData, error: categoryError } = await supabase
      .from("categories")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (categoryError) {
      alert(categoryError.message);
      setLoading(false);
      return;
    }

    if (!categoryData) {
      setCategory(null);
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
          image_url
        )
      `
      )
      .eq("category_id", categoryData.id)
      .eq("status", "active")
      .order("sort_order", { ascending: true });

    if (mappingError) {
      alert(mappingError.message);
      setLoading(false);
      return;
    }

    const mappedRows = (mappingData || []) as unknown as CategoryGameMasterRow[];

    const activeGames = mappedRows
      .map((row) => row.game_master)
      .filter((game): game is GameMaster => Boolean(game))
      .filter((game) => game.status === "active")
      .sort((a, b) => a.name.localeCompare(b.name));

    setGames(activeGames);
    setLoading(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <p className="text-xl font-black text-cyan-300">Loading category...</p>
      </main>
    );
  }

  if (!category) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <p className="text-2xl font-black text-red-300">Category not found</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <section className="px-8 py-10">
        <div className="mx-auto max-w-7xl">
          {bannerImage ? (
            <div className="overflow-hidden rounded-3xl border border-cyan-400/20 bg-white/[0.035] shadow-2xl shadow-cyan-500/10">
              <Image
                src={bannerImage}
                alt={category.name}
                width={1600}
                height={900}
                priority
                className="h-auto w-full object-cover"
              />
            </div>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-8">
              <p className="mb-4 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
                Product Category
              </p>

              <h1 className="text-5xl font-black md:text-7xl">
                {category.icon} {category.name}
              </h1>

              <p className="mt-4 text-gray-400">
                Select a game to browse available offers.
              </p>
            </div>
          )}

          <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/30">
            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
              <div>
                <h2 className="text-3xl font-black">{category.name} Games</h2>

                <p className="mt-2 text-sm text-gray-400">
                  Browse available games from ComePlayers game master catalog.
                </p>
              </div>

              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search games..."
                className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none placeholder:text-gray-500 focus:border-cyan-400 lg:max-w-md"
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                onClick={() => setActiveLetter("all")}
                className={`rounded-full px-4 py-2 text-sm font-black transition ${
                  activeLetter === "all"
                    ? "bg-cyan-400 text-black"
                    : "border border-white/10 bg-black/30 text-gray-300 hover:border-cyan-400 hover:text-white"
                }`}
              >
                All
              </button>

              {letters.map((letter) => (
                <button
                  key={letter}
                  onClick={() => setActiveLetter(letter)}
                  className={`rounded-full px-4 py-2 text-sm font-black transition ${
                    activeLetter === letter
                      ? "bg-cyan-400 text-black"
                      : "border border-white/10 bg-black/30 text-gray-300 hover:border-cyan-400 hover:text-white"
                  }`}
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>

          {filteredGames.length === 0 ? (
            <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.035] p-10 text-center">
              <h2 className="text-3xl font-black">No games found.</h2>

              <p className="mt-3 text-gray-400">
                Try another keyword or add more game mappings in Supabase.
              </p>
            </div>
          ) : (
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {filteredGames.map((game) => (
                <Link
                  key={game.id}
                  href={`/categories/${category.slug}/${game.slug}-${category.slug}`}
                  className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] p-6 transition hover:-translate-y-1 hover:border-cyan-400 hover:bg-cyan-400/10"
                >
                  <div className="flex h-32 items-center justify-center rounded-2xl bg-black/40">
                    {game.image_url ? (
                      <img
                        src={game.image_url}
                        alt={game.name}
                        className="h-full w-full rounded-2xl object-cover"
                      />
                    ) : (
                      <span className="text-5xl">🎮</span>
                    )}
                  </div>

                  <h2 className="mt-5 text-center text-xl font-black group-hover:text-cyan-300">
                    {game.name}
                  </h2>

                  <p className="mt-2 text-center text-sm text-gray-500">
                    {category.name}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}