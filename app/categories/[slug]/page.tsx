"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Category = {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
};

type GameCategory = {
  id: number;
  category_id: number;
  name: string;
  slug: string;
  image_url: string | null;
};

export default function CategoryPage() {
  const params = useParams();
  const slug = String(params.slug || "");

  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<Category | null>(null);
  const [games, setGames] = useState<GameCategory[]>([]);

  useEffect(() => {
    if (slug) {
      loadCategory();
    }
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

    const { data: gameData, error: gameError } = await supabase
      .from("game_categories")
      .select("*")
      .eq("category_id", categoryData.id)
      .order("name", { ascending: true });

    if (gameError) {
      alert(gameError.message);
      setLoading(false);
      return;
    }

    setGames(gameData || []);
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
      <nav className="flex h-20 items-center justify-between border-b border-white/10 bg-[#020617] px-8">
        <Link href="/">
          <img
            src="/logo.png?v=2"
            alt="ComePlayers"
            className="h-16 w-auto object-contain"
          />
        </Link>

        <Link
          href="/"
          className="rounded-full border border-cyan-400 px-5 py-2 font-bold text-cyan-300 hover:bg-cyan-400 hover:text-black"
        >
          Back to Home
        </Link>
      </nav>

      <section className="px-8 py-12">
        <div className="mx-auto max-w-7xl">
          <p className="mb-4 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
            Product Category
          </p>

          <h1 className="text-5xl font-black md:text-7xl">
            {category.icon} {category.name}
          </h1>

          <p className="mt-4 text-gray-400">
            Select a game to browse available offers.
          </p>

          {games.length === 0 ? (
            <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.035] p-10 text-center">
              <h2 className="text-3xl font-black">No games found.</h2>
              <p className="mt-3 text-gray-400">
                Add game categories for this category first.
              </p>
            </div>
          ) : (
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {games.map((game) => (
                <Link
                  key={game.id}
                  href={`/categories/${category.slug}/${game.slug}`}
                  className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] p-6 transition hover:border-cyan-400 hover:bg-cyan-400/10"
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
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}