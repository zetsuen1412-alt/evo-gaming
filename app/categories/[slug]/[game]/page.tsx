"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type GameCategory = {
  id: number;
  category_id: number;
  name: string;
  slug: string;
  image_url: string | null;
  status: string | null;
};

type Product = {
  id: number;
  title: string;
  description: string | null;
  price: string | number | null;
  stock: number | null;
  image_url: string | null;
  seller_name: string | null;
  status: string | null;
  game_category_id: number | null;
  created_at: string;
};

export default function GameProductsPage() {
  const params = useParams();

  const categorySlug = String(params.slug || "");
  const gameSlug = String(params.game || "");

  const [loading, setLoading] = useState(true);
  const [gameCategory, setGameCategory] = useState<GameCategory | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!gameSlug) {
      setLoading(false);
      return;
    }

    loadPage(gameSlug);
  }, [gameSlug]);

  async function loadPage(slug: string) {
    try {
      setLoading(true);

      const { data: gameData, error: gameError } = await supabase
        .from("game_categories")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      if (gameError) {
        alert(gameError.message);
        setLoading(false);
        return;
      }

      if (!gameData) {
        setGameCategory(null);
        setProducts([]);
        setLoading(false);
        return;
      }

      setGameCategory(gameData);

      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("game_category_id", gameData.id)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (productError) {
        alert(productError.message);
        setLoading(false);
        return;
      }

      setProducts(productData || []);
      setLoading(false);
    } catch (error) {
      console.error(error);
      alert("Failed to load products.");
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <p className="text-xl font-black text-cyan-300">Loading products...</p>
      </main>
    );
  }

  if (!gameCategory) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
        <div className="rounded-3xl border border-red-400/20 bg-red-400/10 p-8 text-center">
          <h1 className="text-3xl font-black text-red-300">Game not found</h1>
          <p className="mt-3 text-gray-300">Slug: {gameSlug}</p>

          <Link
            href={`/categories/${categorySlug}`}
            className="mt-6 inline-block rounded-full bg-cyan-400 px-6 py-3 font-black text-black hover:bg-cyan-300"
          >
            Back to Category
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <nav className="sticky top-0 z-50 flex h-20 items-center justify-between border-b border-white/10 bg-[#020617]/90 px-8 backdrop-blur-xl">
        <Link href="/" className="flex items-center">
          <img
            src="/logo.png?v=2"
            alt="ComePlayers"
            className="h-16 w-auto object-contain md:h-20"
          />
        </Link>

        <Link
          href={`/categories/${categorySlug}`}
          className="rounded-full border border-cyan-400 px-5 py-2 font-bold text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
        >
          Back to Games
        </Link>
      </nav>

      <section className="relative overflow-hidden border-b border-white/10 px-8 py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(37,99,235,.18),transparent_34%)]" />

        <div className="relative z-10">
          <p className="mb-4 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
            Game Marketplace
          </p>

          <h1 className="text-5xl font-black md:text-7xl">
            {gameCategory.name}
          </h1>

          <p className="mt-5 max-w-2xl text-gray-300">
            Browse available seller listings for this game.
          </p>
        </div>
      </section>

      <section className="px-8 py-10">
        {products.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-12 text-center">
            <h2 className="text-3xl font-black">No Products Yet</h2>
            <p className="mt-3 text-gray-400">
              Sellers have not listed products for this game yet.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <Link
                key={product.id}
                href={`/product/${product.id}`}
                className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] transition hover:border-cyan-400 hover:bg-cyan-400/10"
              >
                <div className="flex h-52 items-center justify-center bg-black">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-6xl">🎮</span>
                  )}
                </div>

                <div className="p-5">
                  <h3 className="line-clamp-2 text-xl font-black group-hover:text-cyan-300">
                    {product.title}
                  </h3>

                  <p className="mt-3 text-2xl font-black text-cyan-300">
                    Rp {Number(product.price || 0).toLocaleString("id-ID")}
                  </p>

                  <p className="mt-2 text-sm text-gray-400">
                    Seller: {product.seller_name || "Unknown Seller"}
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    Stock: {product.stock || 0}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}