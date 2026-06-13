"use client";

import { useEffect, useState } from "react";
import GameCard from "@/components/games/GameCard";
import GameSearchAutocomplete from "@/components/games/GameSearchAutocomplete";

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
  const [games, setGames] = useState<Game[]>([]);
  const [query, setQuery] = useState("");
  const [letter, setLetter] = useState("");
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  async function loadGames(nextPage = 1, nextQuery = query, nextLetter = letter) {
    setLoading(true);

    const params = new URLSearchParams({
      page: String(nextPage),
      limit: "48",
    });

    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (nextLetter && nextLetter !== "All") params.set("letter", nextLetter);

    const res = await fetch(`/api/games?${params.toString()}`);
    const json = await res.json();

    setGames(json.games || []);
    setCount(json.count || 0);
    setPage(nextPage);
    setLoading(false);
  }

  useEffect(() => {
    loadGames(1, "", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            our master game database.
          </p>

          <div className="mt-8 max-w-2xl">
            <GameSearchAutocomplete />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-black">All Games</h2>
            <p className="mt-1 text-slate-400">
              {count.toLocaleString("id-ID")} games found
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              loadGames(1, query, letter);
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
                  loadGames(1, query, nextLetter);
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
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        )}

        <div className="mt-10 flex items-center justify-center gap-3">
          <button
            disabled={page <= 1}
            onClick={() => loadGames(page - 1)}
            className="rounded-xl border border-white/10 px-5 py-3 font-bold text-white transition hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>

          <span className="text-sm text-slate-400">
            Page {page} / {totalPages}
          </span>

          <button
            disabled={page >= totalPages}
            onClick={() => loadGames(page + 1)}
            className="rounded-xl border border-white/10 px-5 py-3 font-bold text-white transition hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </section>
    </main>
  );
}