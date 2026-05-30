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

  return (
    <main
      className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat text-white"
      style={{
        backgroundImage:
          "linear-gradient(rgba(3,7,18,.72), rgba(3,7,18,.78)), url('/hero-bg.webp')",
      }}
    >
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-white/10 bg-gray-950/80 px-8 py-4 backdrop-blur">
        <Link href="/">
          <img
  src="/logo-transparent.png?v=3"
  alt="ComePlayers"
  className="h-20 w-auto object-contain"
/>
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/seller"
            className="rounded-full border border-cyan-400 px-6 py-2 text-cyan-400 hover:bg-cyan-400 hover:text-black"
          >
            Sell With Us
          </Link>

          <Link
            href="/login"
            className="rounded-full border border-gray-600 px-6 py-2 hover:bg-white hover:text-black"
          >
            Login
          </Link>

          <Link
            href="/register"
            className="rounded-full bg-cyan-400 px-6 py-2 font-bold text-black hover:bg-cyan-300"
          >
            Sign Up
          </Link>
        </div>
      </nav>

      <section className="px-8 pt-32 pb-24">
        <div className="max-w-4xl">
          <h1 className="text-4xl md:text-6xl font-black leading-tight">
            All Your Gaming Needs
            <br />
            in One Secure{" "}
            <span className="text-yellow-400">Marketplace</span>
          </h1>

          <p className="mt-8 max-w-2xl text-xl text-gray-300">
            Buy and sell game accounts, top-ups, gift cards, coins, boosting,
            and digital items safely.
          </p>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search in ComePlayers"
            className="mt-10 w-full max-w-2xl rounded-2xl border border-gray-700 bg-gray-900/80 px-6 py-4 outline-none focus:border-cyan-400"
          />
        </div>
      </section>

      <section className="px-8 pb-24">
        <h2 className="mb-8 text-3xl font-black">Select Categories</h2>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {categories
            .filter((category) =>
              category.name.toLowerCase().includes(search.toLowerCase())
            )
            .map((category) => (
              <Link
                key={category.id}
                href={`/categories/${category.slug}`}
                className="rounded-3xl border border-gray-800 bg-gray-900/85 p-6 transition hover:border-cyan-400 hover:bg-gray-800/90"
              >
                <div className="text-4xl">{category.icon}</div>

                <h3 className="mt-5 text-2xl font-black">{category.name}</h3>

                <p className="mt-2 text-gray-400">Explore products</p>
              </Link>
            ))}
        </div>
      </section>
    </main>
  );
}