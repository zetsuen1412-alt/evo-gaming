"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Order = {
  id: number;
  product: string | null;
  buyer: string | null;
  price: string | number | null;
  status: string | null;
  seller_id: string | null;
  created_at: string;
};

export default function ReviewPage() {
  const params = useParams();
  const orderId = String(params.id);

  const [user, setUser] = useState<User | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadReviewPage() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        setUser(null);
        setLoading(false);
        return;
      }

      setUser(userData.user);

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle();

      if (error) {
        alert(error.message);
        setLoading(false);
        return;
      }

      setOrder(data);
      setLoading(false);
    }

    loadReviewPage();
  }, [orderId]);

  async function submitReview(event: React.FormEvent) {
    event.preventDefault();

    if (!user || !order) return;

    if (order.buyer !== user.email) {
      alert("You can only review your own order.");
      return;
    }

    if (order.status !== "Completed" && order.status !== "Selesai") {
      alert("You can only review completed orders.");
      return;
    }

    if (!title || !message) {
      alert("Please fill in review title and message.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("reviews").insert({
      order_id: order.id,
      product: order.product,
      buyer: user.email,
      seller_id: order.seller_id,
      rating,
      title,
      message,
    });

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    alert("Review submitted successfully.");
    window.location.href = "/my-orders";
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <p className="text-xl font-black text-cyan-300">Loading review...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
        <div className="max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <h1 className="text-3xl font-black text-cyan-300">Login Required</h1>
          <p className="mt-4 text-gray-400">
            Please login first to leave a review.
          </p>
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

  if (!order) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
        <div className="max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <h1 className="text-3xl font-black text-cyan-300">Order Not Found</h1>
          <p className="mt-4 text-gray-400">
            The order you want to review does not exist.
          </p>
          <Link
            href="/my-orders"
            className="mt-6 inline-block rounded-full bg-cyan-400 px-6 py-3 font-black text-black"
          >
            Back to My Orders
          </Link>
        </div>
      </main>
    );
  }

  const canReview =
    order.buyer === user.email &&
    (order.status === "Completed" || order.status === "Selesai");

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
          href="/my-orders"
          className="rounded-full border border-cyan-400 px-5 py-2 font-bold text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
        >
          My Orders
        </Link>
      </nav>

      <section className="relative overflow-hidden border-b border-white/10 px-8 py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(37,99,235,.18),transparent_34%)]" />

        <div className="relative z-10">
          <p className="mb-4 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
            Review System
          </p>

          <h1 className="text-5xl font-black md:text-7xl">Leave a Review</h1>

          <p className="mt-5 max-w-2xl text-gray-300">
            Share your experience and help other buyers trust great sellers.
          </p>
        </div>
      </section>

      <section className="grid gap-8 px-8 py-10 lg:grid-cols-[1fr_420px]">
        <form
          onSubmit={submitReview}
          className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/30"
        >
          <h2 className="text-3xl font-black">Your Review</h2>

          {!canReview && (
            <div className="mt-5 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-5 text-yellow-200">
              This order is not eligible for review yet. Only completed orders
              can be reviewed.
            </div>
          )}

          <div className="mt-7">
            <label className="mb-3 block text-sm font-bold text-gray-300">
              Rating
            </label>

            <div className="flex gap-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`text-4xl transition ${
                    star <= rating ? "text-yellow-300" : "text-gray-600"
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <div className="mt-7">
            <label className="mb-3 block text-sm font-bold text-gray-300">
              Review Title
            </label>

            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Example: Fast and trusted seller"
              className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 outline-none focus:border-cyan-400"
            />
          </div>

          <div className="mt-7">
            <label className="mb-3 block text-sm font-bold text-gray-300">
              Review Message
            </label>

            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Write your honest experience..."
              rows={7}
              className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 outline-none focus:border-cyan-400"
            />
          </div>

          <button
            disabled={!canReview || saving}
            className="mt-8 w-full rounded-2xl bg-cyan-400 py-4 text-lg font-black text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-gray-600 disabled:text-gray-300"
          >
            {saving ? "Submitting Review..." : "Submit Review"}
          </button>
        </form>

        <aside className="h-fit rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/30">
          <h2 className="text-3xl font-black">Order Summary</h2>

          <div className="mt-6 grid gap-4">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <p className="text-sm text-gray-400">Order ID</p>
              <p className="mt-1 text-xl font-black">#{order.id}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <p className="text-sm text-gray-400">Product</p>
              <p className="mt-1 text-xl font-black">
                {order.product || "Unknown Product"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <p className="text-sm text-gray-400">Price</p>
              <p className="mt-1 text-3xl font-black text-cyan-300">
                {order.price}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <p className="text-sm text-gray-400">Status</p>
              <p className="mt-1 font-black">{order.status}</p>
            </div>
          </div>

          <div className="mt-7 rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5">
            <h3 className="font-black text-cyan-300">Review Protection</h3>

            <p className="mt-3 text-sm text-gray-300">
              Reviews are only available for completed orders to keep the
              marketplace safe and trustworthy.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}