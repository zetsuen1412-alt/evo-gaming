"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Product = {
  id: number;
  title: string;
  description: string | null;
  price: string | number | null;
  seller_id: string | null;
  seller_name: string | null;
  image_url: string | null;
  stock: number | null;
  status: string | null;
};

function formatPrice(value: string | number | null) {
  const price = Number(value || 0);
  return `Rp ${price.toLocaleString("id-ID")}`;
}

export default function CheckoutPage() {
  const params = useParams();
  const productId = String(params.id || "");

  const [loading, setLoading] = useState(true);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [buyerNote, setBuyerNote] = useState("");

  useEffect(() => {
    loadCheckout();
  }, []);

  async function loadCheckout() {
    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session?.user) {
      alert("Please login before checkout.");
      window.location.href = "/login";
      return;
    }

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", Number(productId))
      .maybeSingle();

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    if (!data) {
      setProduct(null);
      setLoading(false);
      return;
    }

    setProduct(data);
    setLoading(false);
  }

  async function createOrder() {
    if (!product) return;

    if (product.status !== "active") {
      alert("This product is not available.");
      return;
    }

    if (Number(product.stock || 0) <= 0) {
      alert("This product is out of stock.");
      return;
    }

    setCreatingOrder(true);

    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session?.user) {
      alert("Please login again.");
      window.location.href = "/login";
      return;
    }

    const buyer = sessionData.session.user;

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert({
        buyer_id: buyer.id,
        seller_id: product.seller_id,
        product_id: product.id,
        quantity: 1,
        total_price: Number(product.price || 0),
        status: "pending_payment",
        buyer_note: buyerNote.trim() || null,
      })
      .select("*")
      .single();

    if (orderError) {
      alert(`Order Error: ${orderError.message}`);
      setCreatingOrder(false);
      return;
    }

    alert("Order created successfully.");
    window.location.href = `/payment?order=${orderData.id}`;
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <p className="text-xl font-black text-cyan-300">
          Loading checkout...
        </p>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <div className="rounded-3xl border border-red-400/20 bg-red-400/10 p-8 text-center">
          <h1 className="text-3xl font-black text-red-300">
            Product not found
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
          href={`/product/${product.id}`}
          className="rounded-full border border-cyan-400 px-5 py-2 font-bold text-cyan-300 hover:bg-cyan-400 hover:text-black"
        >
          Back to Product
        </Link>
      </nav>

      <section className="mx-auto grid max-w-7xl gap-8 px-8 py-10 lg:grid-cols-[1fr_420px]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-7">
          <h1 className="text-4xl font-black">Checkout</h1>
          <p className="mt-3 text-gray-400">
            Review your order before continuing to payment.
          </p>

          <div className="mt-8 flex gap-5 rounded-3xl border border-white/10 bg-black/30 p-5">
            <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-2xl bg-black">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-5xl">🎮</span>
              )}
            </div>

            <div className="flex-1">
              <h2 className="text-2xl font-black">{product.title}</h2>

              <p className="mt-2 text-sm text-gray-400">
                Seller: {product.seller_name || "Unknown Seller"}
              </p>

              <p className="mt-4 text-3xl font-black text-cyan-300">
                {formatPrice(product.price)}
              </p>

              <p className="mt-2 text-sm text-gray-400">
                Stock: {product.stock || 0}
              </p>
            </div>
          </div>

          <div className="mt-8">
            <label className="mb-2 block text-sm font-bold text-gray-300">
              Buyer Note
            </label>

            <textarea
              value={buyerNote}
              onChange={(event) => setBuyerNote(event.target.value)}
              placeholder="Write your account ID, server, character name, or other order details here."
              rows={6}
              className="w-full resize-none rounded-2xl border border-white/10 bg-black px-5 py-4 outline-none focus:border-cyan-400"
            />
          </div>

          <div className="mt-8 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-5">
            <h3 className="font-black text-yellow-300">Important Notice</h3>
            <p className="mt-3 text-sm leading-6 text-gray-300">
              Always complete payment through ComePlayers. Do not send payment
              directly to the seller outside the platform.
            </p>
          </div>
        </div>

        <aside className="h-fit rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-7">
          <h2 className="text-3xl font-black">Order Summary</h2>

          <div className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="flex justify-between">
              <span className="text-gray-400">Product Price</span>
              <span className="font-black">{formatPrice(product.price)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-400">Quantity</span>
              <span className="font-black">1</span>
            </div>

            <div className="border-t border-white/10 pt-4">
              <div className="flex justify-between">
                <span className="text-gray-400">Total</span>
                <span className="text-3xl font-black text-cyan-300">
                  {formatPrice(product.price)}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={createOrder}
            disabled={creatingOrder}
            className="mt-6 w-full rounded-2xl bg-cyan-400 py-4 text-lg font-black text-black hover:bg-cyan-300 disabled:opacity-50"
          >
            {creatingOrder ? "Creating Order..." : "Continue to Payment"}
          </button>
        </aside>
      </section>
    </main>
  );
}