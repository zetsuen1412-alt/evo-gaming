"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Product = {
  id: number;
  title: string;
  price: string;
  seller: string | null;
  seller_id: string | null;
  description: string | null;
  category: string | null;
  image_url: string | null;
  stock: number | null;
  status: string | null;
};

export default function CheckoutPage() {
  const params = useParams();
  const productId = String(params.id);

  const [product, setProduct] = useState<Product | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);

  const [gameUid, setGameUid] = useState("");
  const [nickname, setNickname] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    async function loadCheckout() {
      const { data: userData } = await supabase.auth.getUser();
      setUser(userData.user);

      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .maybeSingle();

      if (error) {
        console.error(error.message);
      }

      setProduct(data);
      setLoading(false);
    }

    if (productId) loadCheckout();
  }, [productId]);

  async function handlePlaceOrder(e: React.FormEvent) {
    e.preventDefault();

    if (!user) {
      alert("Silakan login terlebih dahulu.");
      return;
    }

    if (!product) return;

    if (!gameUid || !nickname) {
      alert("UID dan Nickname wajib diisi.");
      return;
    }

    setPlacingOrder(true);

    const { error } = await supabase.from("orders").insert({
      product: product.title,
      buyer: user.email,
      price: product.price,
      status: "Menunggu Pembayaran",
      payment_proof: `UID: ${gameUid} | Nickname: ${nickname} | Notes: ${
        notes || "-"
      }`,
      payment_image: null,
      seller_id: product.seller_id,
    });

    if (error) {
      alert(error.message);
      setPlacingOrder(false);
      return;
    }

    alert("Order berhasil dibuat. Lanjutkan ke pembayaran.");
    window.location.href = "/payment";
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <p className="text-xl font-black text-cyan-300">Loading checkout...</p>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <h1 className="text-3xl font-black text-cyan-300">
            Product Not Found
          </h1>

          <Link
            href="/"
            className="mt-6 inline-block rounded-full bg-cyan-400 px-6 py-3 font-black text-black"
          >
            Back to Home
          </Link>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
        <div className="max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <h1 className="text-3xl font-black text-cyan-300">
            Login Required
          </h1>

          <p className="mt-4 text-gray-400">
            Kamu harus login terlebih dahulu sebelum checkout.
          </p>

          <Link
            href={`/product/${product.id}`}
            className="mt-6 inline-block rounded-full bg-cyan-400 px-6 py-3 font-black text-black"
          >
            Back to Product
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <nav className="flex h-20 items-center justify-between border-b border-white/10 bg-[#020617]/90 px-8">
        <Link href="/">
          <img src="/logo.png?v=2" alt="ComePlayers" className="h-16 w-auto" />
        </Link>

        <Link
          href={`/product/${product.id}`}
          className="rounded-full border border-cyan-400 px-5 py-2 font-bold text-cyan-300 hover:bg-cyan-400 hover:text-black"
        >
          Back
        </Link>
      </nav>

      <section className="grid gap-10 px-8 py-10 lg:grid-cols-[1fr_420px]">
        <form
          onSubmit={handlePlaceOrder}
          className="rounded-3xl border border-white/10 bg-white/[0.04] p-7"
        >
          <h1 className="text-4xl font-black text-cyan-300">Checkout</h1>

          <p className="mt-3 text-gray-400">
            Isi detail akun / karakter kamu untuk memproses order.
          </p>

          <div className="mt-8 grid gap-5">
            <div>
              <label className="mb-2 block text-sm font-bold text-gray-300">
                Game UID / User ID
              </label>
              <input
                value={gameUid}
                onChange={(e) => setGameUid(e.target.value)}
                placeholder="Masukkan UID game kamu"
                className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-300">
                Nickname
              </label>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Masukkan nickname kamu"
                className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-300">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan tambahan untuk seller..."
                rows={5}
                className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <button
            disabled={placingOrder}
            className="mt-8 w-full rounded-2xl bg-cyan-400 py-4 text-lg font-black text-black hover:bg-cyan-300 disabled:opacity-60"
          >
            {placingOrder ? "Creating Order..." : "Place Order"}
          </button>
        </form>

        <aside className="h-fit rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-2xl font-black">Order Summary</h2>

          <div className="mt-5 overflow-hidden rounded-2xl bg-black">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.title}
                className="h-56 w-full object-cover"
              />
            ) : (
              <div className="flex h-56 items-center justify-center text-gray-600">
                No Image
              </div>
            )}
          </div>

          <h3 className="mt-5 text-2xl font-black">{product.title}</h3>

          <p className="mt-2 text-sm text-gray-400">{product.category}</p>

          <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-5">
            <p className="text-sm text-gray-300">Total Price</p>
            <p className="mt-1 text-4xl font-black text-cyan-300">
              {product.price}
            </p>
          </div>

          <div className="mt-5 grid gap-3 text-sm text-gray-300">
            <p>Seller: {product.seller || "Unknown Seller"}</p>
            <p>Stock: {product.stock ?? 0}</p>
            <p>Buyer: {user.email}</p>
          </div>
        </aside>
      </section>
    </main>
  );
}