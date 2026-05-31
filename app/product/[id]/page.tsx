"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Product = {
  id: number;
  created_at: string;
  title: string;
  price: string;
  seller: string | null;
  seller_id: string | null;
  description: string | null;
  category: string | null;
  slug: string | null;
  image_url: string | null;
  stock: number | null;
  status: string | null;
  category_id: number | null;
};

export default function ProductDetailPage() {
  const params = useParams();
  const productId = String(params.id);

  const [product, setProduct] = useState<Product | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProduct() {
      setLoading(true);

      const { data: userData } = await supabase.auth.getUser();
      setUser(userData.user);

      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .maybeSingle();

      if (error) {
        console.error(error.message);
        setProduct(null);
        setLoading(false);
        return;
      }

      setProduct(data);
      setLoading(false);
    }

    if (productId) loadProduct();
  }, [productId]);

  function handleBuyNow() {
    if (!product) return;

    if (!user) {
      alert("Silakan login terlebih dahulu sebelum membeli product.");
      return;
    }

    window.location.href = `/order/${product.id}`;
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <p className="text-xl font-black text-cyan-300">
            Loading product...
          </p>
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
        <div className="max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <h1 className="text-3xl font-black text-cyan-300">
            Product Not Found
          </h1>

          <p className="mt-4 text-gray-400">
            Product yang kamu buka tidak ditemukan.
          </p>

          <Link
            href="/"
            className="mt-6 inline-block rounded-full bg-cyan-400 px-6 py-3 font-black text-black hover:bg-cyan-300"
          >
            Back to Home
          </Link>
        </div>
      </main>
    );
  }

  const isAvailable = product.status === "active" && (product.stock || 0) > 0;

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <nav className="sticky top-0 z-50 flex h-20 items-center justify-between border-b border-white/10 bg-[#020617]/90 px-8 backdrop-blur-xl">
        <div className="flex items-center gap-5">
          <Link href="/" className="flex items-center">
            <img
              src="/logo.png?v=2"
              alt="ComePlayers"
              className="h-16 w-auto object-contain md:h-20"
            />
          </Link>

          <div className="hidden border-l border-white/10 pl-5 lg:block">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">
              Powered By
            </p>
            <p className="bg-gradient-to-r from-cyan-300 to-blue-500 bg-clip-text text-lg font-black text-transparent">
              EvoGaming
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/seller"
            className="hidden rounded-full border border-cyan-400 px-5 py-2 font-semibold text-cyan-300 transition hover:bg-cyan-400 hover:text-black sm:block"
          >
            Sell With Us
          </Link>

          <Link
            href="/"
            className="rounded-full bg-cyan-400 px-5 py-2 font-black text-black transition hover:bg-cyan-300"
          >
            Home
          </Link>
        </div>
      </nav>

      <section className="relative overflow-hidden border-b border-white/10 px-8 py-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.16),transparent_35%),radial-gradient(circle_at_top_right,rgba(37,99,235,.16),transparent_35%)]" />

        <div className="relative z-10">
          <Link
            href={`/categories/${product.category?.toLowerCase().replaceAll(" ", "-")}`}
            className="text-sm font-bold text-cyan-300 hover:text-cyan-200"
          >
            ← Back to {product.category || "Category"}
          </Link>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-300">
              {product.category || "No Category"}
            </span>

            <span
              className={`rounded-full px-4 py-2 text-sm font-bold ${
                isAvailable
                  ? "border border-green-400/20 bg-green-400/10 text-green-300"
                  : "border border-red-400/20 bg-red-400/10 text-red-300"
              }`}
            >
              {isAvailable ? "Available" : "Unavailable"}
            </span>
          </div>
        </div>
      </section>

      <section className="grid gap-10 px-8 py-10 lg:grid-cols-[1.1fr_.9fr]">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] shadow-2xl shadow-black/40">
          <div className="h-[420px] bg-black">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-gray-600">
                No Image
              </div>
            )}
          </div>

          <div className="border-t border-white/10 p-6">
            <h2 className="text-2xl font-black">Description</h2>

            <p className="mt-4 whitespace-pre-line leading-relaxed text-gray-300">
              {product.description || "No description available."}
            </p>
          </div>
        </div>

        <aside className="h-fit rounded-3xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl shadow-black/40 backdrop-blur">
          <h1 className="text-4xl font-black leading-tight">
            {product.title}
          </h1>

          <div className="mt-6 rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5">
            <p className="text-sm font-bold text-gray-300">Price</p>
            <p className="mt-1 text-4xl font-black text-cyan-300">
              {product.price}
            </p>
          </div>

          <div className="mt-6 grid gap-4">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-sm text-gray-400">Seller</p>
              <p className="mt-1 font-bold text-white">
                {product.seller || "Unknown Seller"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-sm text-gray-400">Stock</p>
              <p className="mt-1 font-bold text-white">
                {product.stock ?? 0}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-sm text-gray-400">Product ID</p>
              <p className="mt-1 font-bold text-white">#{product.id}</p>
            </div>
          </div>

          <button
            onClick={handleBuyNow}
            disabled={!isAvailable}
            className="mt-7 w-full rounded-2xl bg-cyan-400 py-4 text-lg font-black text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-gray-600 disabled:text-gray-300"
          >
            {isAvailable ? "Buy Now" : "Unavailable"}
          </button>

          <button
            onClick={() => alert("Chat seller akan kita buat setelah checkout.")}
            className="mt-4 w-full rounded-2xl border border-white/15 py-4 font-black text-white transition hover:bg-white hover:text-black"
          >
            Contact Seller
          </button>

          <div className="mt-7 rounded-3xl border border-white/10 bg-black/30 p-5">
            <h3 className="font-black text-cyan-300">
              ComePlayers Protection
            </h3>

            <ul className="mt-4 grid gap-3 text-sm text-gray-300">
              <li>🔒 Secure transaction protection</li>
              <li>⚡ Fast delivery from trusted sellers</li>
              <li>🎧 Support available when needed</li>
            </ul>
          </div>
        </aside>
      </section>
    </main>
  );
}