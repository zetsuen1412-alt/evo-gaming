"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import RecentlyViewed from "@/components/marketplace/RecentlyViewed";
import RecentlyViewedGames from "@/components/marketplace/RecentlyViewedGames";
import InterestRecommendations from "@/components/marketplace/InterestRecommendations";
import RecommendedGames from "@/components/marketplace/RecommendedGames";
import FollowedSellerFeed from "@/components/marketplace/FollowedSellerFeed";

type Category = {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
};

export default function Home() {
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);

  const search = searchParams.get("q") || "";

  useEffect(() => {
    async function initializePage() {
      const { data: categoryData } = await supabase
        .from("categories")
        .select("*")
        .order("id", { ascending: true });

      setCategories(categoryData || []);
    }

    initializePage();
  }, []);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories;

    return categories.filter((category) =>
      category.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [categories, search]);

  return (
    <main
      className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat text-white"
      style={{
        backgroundImage:
          "linear-gradient(rgba(2,6,23,.72), rgba(2,6,23,.9)), url('/hero-bg.webp')",
      }}
    >
      <section className="px-8 pb-12 pt-16">
        <div className="max-w-4xl">
          <p className="mb-6 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm font-black text-cyan-300">
            🚀 Trusted Marketplace For Gamers
          </p>

          <h1 className="text-5xl font-black leading-[1.05] md:text-6xl lg:text-7xl">
            All Your Gaming
            <br />
            Needs in One
            <br />
            Secure <span className="text-yellow-400">Marketplace</span>
          </h1>

          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-gray-200">
            Buy and sell game accounts, top-ups, gift cards, coins, boosting,
            skins, software, and digital items safely with trusted transaction
            protection.
          </p>

          <div className="mt-8 grid max-w-xl gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
              <p className="text-3xl font-black text-cyan-300">500+</p>
              <p className="text-sm text-gray-300">Products</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
              <p className="text-3xl font-black text-cyan-300">100+</p>
              <p className="text-sm text-gray-300">Sellers</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
              <p className="text-3xl font-black text-cyan-300">24/7</p>
              <p className="text-sm text-gray-300">Support</p>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-3 text-sm font-bold">
            <span className="rounded-full border border-white/10 bg-black/30 px-4 py-2">
              🔒 Secure Transactions
            </span>

            <span className="rounded-full border border-white/10 bg-black/30 px-4 py-2">
              ⚡ Fast Delivery
            </span>

            <span className="rounded-full border border-white/10 bg-black/30 px-4 py-2">
              🎧 24/7 Support
            </span>
          </div>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/discover"
              className="inline-flex items-center justify-center rounded-full bg-yellow-400 px-6 py-4 text-sm font-black text-black shadow-2xl shadow-yellow-400/20 transition hover:bg-yellow-300"
            >
              Explore Marketplace Discovery →
            </Link>

            <Link
              href="/games"
              className="inline-flex items-center justify-center rounded-full border border-cyan-400 px-6 py-4 text-sm font-black text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
            >
              Browse Games
            </Link>
          </div>
        </div>
      </section>

      <section className="px-8 pb-16">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-4xl font-black">Select Categories</h2>

            <p className="mt-2 text-gray-300">
              Explore trusted games by marketplace category.
            </p>
          </div>
        </div>

        {filteredCategories.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-10 text-center">
            <h3 className="text-2xl font-black">No categories found.</h3>

            <p className="mt-3 text-gray-400">
              Try searching with another keyword.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {filteredCategories.map((category) => (
              <Link
                key={category.id}
                href={`/games?category=${encodeURIComponent(category.slug)}`}
                className="group rounded-3xl border border-white/10 bg-white/[0.055] p-6 shadow-2xl shadow-black/30 backdrop-blur transition hover:-translate-y-1 hover:border-cyan-400 hover:bg-cyan-950/20"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-2xl">
                  {category.icon || "🎮"}
                </div>

                <h3 className="mt-6 text-2xl font-black group-hover:text-cyan-300">
                  {category.name}
                </h3>

                <p className="mt-2 text-gray-400">Browse games</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <RecentlyViewed />
      <RecentlyViewedGames />
      <RecommendedGames />
      <InterestRecommendations />
      <FollowedSellerFeed />
    </main>
  );
}