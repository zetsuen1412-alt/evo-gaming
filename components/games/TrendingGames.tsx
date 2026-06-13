"use client";

import { useEffect, useState } from "react";
import GameCard from "./GameCard";

type Game = {
  id: number;
  name: string;
  slug: string;
  cover_image_url: string | null;
  offer_count: number;
  is_trending: boolean;
};

export default function TrendingGames() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTrending = async () => {
      const response = await fetch("/api/games/trending");
      const payload = await response.json();
      setGames(payload.games || []);
      setLoading(false);
    };
    void loadTrending();
  }, []);

  if (loading) return <p className="text-slate-400">Loading trending games...</p>;
  if (games.length === 0) return <p className="text-slate-400">No trending games yet.</p>;

  return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{games.map((game) => <GameCard key={game.id} game={game} />)}</div>;
}
