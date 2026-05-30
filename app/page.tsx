"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Category = {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
};

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadCategories() {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("id", { ascending: true });

      if (error) {
        alert(error.message);
        return;
      }

      setCategories(data || []);
    }

    loadCategories();
  }, []);

  const filteredCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main
      className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat text-white"
      style={{
        backgroundImage:
          "linear-gradient(rgba(3,7,18,.62), rgba(3,7,18,.82)), url('/hero-bg.webp')",
      }}
    >
      <nav className="sticky top-0 z-50 flex h-24 items-center justify-between border-b border-white/10 bg-gray-950/85 px-8 backdrop-blur">
        <Link href="/" className="flex items-center">
          <img
  src="/logo.png?v=1"
  alt="ComePlayers"
  className="h-20 w-auto object-contain"
/>
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/seller"
            className="rounded-full border border-cyan-400 px-6 py-2 font-semibold text-cyan-400 transition hover:bg-cyan-400 hover:text-black"
          >
            Sell With Us
          </Link>

          <Link
            href="/login"
            className="rounded-full border border-white/30 px-6 py-2 font-semibold transition hover:bg-white hover:text-black"
          >
            Login
          </Link>

          <Link
            href="/register"
            className="rounded-full bg-cyan-400 px-6 py-2 font-bold text-black transition hover:bg-cyan-300"
          >
            Sign Up
          </Link>
        </div>
      </nav>

      <section className="px-8 pt-24 pb-10">
        <div className="max-w-5xl">
          <h1 className="max-w-4xl text-5xl font-black leading-tight md:text-7xl">
            All Your Gaming Needs
            <br />
            in One Secure{" "}
            <span className="text-yellow-400">Marketplace</span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg text-gray-200 md:text-xl">
            Buy and sell game accounts, top-ups, gift cards, coins, boosting,
            and digital items safely with trusted transaction protection.
          </p>

          <div className="mt-8 max-w-2xl rounded-2xl border border-white/15 bg-black/35 p-2 backdrop-blur-md">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search in ComePlayers"
              className="w-full rounded-xl bg-transparent px-5 py-3 text-white outline-none placeholder:text-gray-400"
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold text-gray-200">
            <span>🔒 Secure Transactions</span>
            <span>⚡ Fast Delivery</span>
            <span>🎧 24/7 Support</span>
          </div>
        </div>
      </section>

      <section className="px-8 pb-24">
        <h2 className="mb-6 text-3xl font-black">Select Categories</h2>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {filteredCategories.map((category) => (
            <Link
              key={category.id}
              href={`/categories/${category.slug}`}
              className="group rounded-3xl border border-white/10 bg-black/35 p-6 backdrop-blur-md transition hover:-translate-y-1 hover:border-cyan-400 hover:bg-black/50"
            >
              <div className="text-4xl">{category.icon}</div>

              <h3 className="mt-5 text-2xl font-black group-hover:text-cyan-300">
                {category.name}
              </h3>

              <p className="mt-2 text-gray-300">Explore products</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}