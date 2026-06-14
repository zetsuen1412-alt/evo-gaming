"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { createNotification } from "@/lib/createNotification";
import { calculateSellerReputation } from "@/lib/sellerReputation";

type SellerProfile = {
  id: string;
  email: string | null;
  username: string | null;
  seller_name: string | null;
  seller_status: string | null;
  avatar_url: string | null;
  bio: string | null;
  discord: string | null;
  created_at: string;
};

type Product = {
  id: number;
  title: string | null;
  price: string | number | null;
  image_url: string | null;
  category: string | null;
  game_name: string | null;
  stock: number | null;
  status: string | null;
  created_at: string;
};

type Review = {
  id: number;
  order_id: number;
  product_id: number | null;
  seller_id: string;
  buyer_id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
};

type Order = {
  id: number;
  seller_id: string | null;
  status: string | null;
};

type FollowRow = {
  id: number;
  follower_id: string;
  seller_id: string;
};

function formatPrice(value: string | number | null) {
  const price = Number(value || 0);
  if (!Number.isFinite(price)) return "Rp 0";
  return `Rp ${price.toLocaleString("id-ID")}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("id-ID", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function normalizeStatus(status: string | null) {
  if (status === "Selesai") return "Completed";
  return status || "";
}

function renderStars(rating: number) {
  return "★★★★★".slice(0, rating) + "☆☆☆☆☆".slice(0, 5 - rating);
}

export default function SellerProfileV3NotificationFollowerPage() {
  const params = useParams();
  const sellerId = String(params.id || "");

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);

  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [followRow, setFollowRow] = useState<FollowRow | null>(null);
  const [followersCount, setFollowersCount] = useState(0);

  const sellerDisplayName = useMemo(() => {
    return seller?.seller_name || seller?.username || seller?.email || "Seller";
  }, [seller]);

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0;

    const total = reviews.reduce(
      (sum, review) => sum + Number(review.rating),
      0,
    );

    return total / reviews.length;
  }, [reviews]);

  const completedOrders = useMemo(() => {
    return orders.filter(
      (order) => normalizeStatus(order.status) === "Completed",
    ).length;
  }, [orders]);

  const activeProducts = useMemo(() => {
    return products.filter((product) => product.status === "active");
  }, [products]);

  const sellerReputation = useMemo(() => {
    return calculateSellerReputation({
      averageRating,
      reviewCount: reviews.length,
      completedOrders,
      activeProducts: activeProducts.length,
      followersCount,
      sellerStatus: seller?.seller_status || null,
    });
  }, [
    averageRating,
    reviews.length,
    completedOrders,
    activeProducts.length,
    followersCount,
    seller?.seller_status,
  ]);

  const isOwnProfile = currentUser?.id === sellerId;
  const isFollowing = Boolean(followRow);

  useEffect(() => {
    if (sellerId) {
      loadSellerProfile();
    }
  }, [sellerId]);

  async function loadSellerProfile() {
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const loggedInUser = userData.user || null;
    setCurrentUser(loggedInUser);

    const { data: sellerData, error: sellerError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", sellerId)
      .maybeSingle();

    if (sellerError) {
      alert(sellerError.message);
      setLoading(false);
      return;
    }

    if (!sellerData) {
      setSeller(null);
      setLoading(false);
      return;
    }

    setSeller(sellerData);

    const { data: productData, error: productError } = await supabase
      .from("products")
      .select("*")
      .eq("seller_id", sellerId)
      .eq("status", "active")
      .order("id", { ascending: false });

    if (productError) {
      alert(productError.message);
      setLoading(false);
      return;
    }

    setProducts(productData || []);

    const { data: reviewData, error: reviewError } = await supabase
      .from("seller_reviews")
      .select("*")
      .eq("seller_id", sellerId)
      .order("id", { ascending: false });

    if (reviewError) {
      alert(reviewError.message);
      setLoading(false);
      return;
    }

    setReviews(reviewData || []);

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("id,seller_id,status")
      .eq("seller_id", sellerId);

    if (orderError) {
      alert(orderError.message);
      setLoading(false);
      return;
    }

    setOrders(orderData || []);

    const { count: followerCountResult } = await supabase
      .from("seller_followers")
      .select("*", { count: "exact", head: true })
      .eq("seller_id", sellerId);

    setFollowersCount(followerCountResult || 0);

    if (loggedInUser && loggedInUser.id !== sellerId) {
      const { data: followData } = await supabase
        .from("seller_followers")
        .select("id,follower_id,seller_id")
        .eq("follower_id", loggedInUser.id)
        .eq("seller_id", sellerId)
        .maybeSingle();

      setFollowRow(followData || null);
    }

    setLoading(false);
  }

  async function toggleFollow() {
    if (!currentUser) {
      alert("Please login before following seller.");
      window.location.href = "/";
      return;
    }

    if (currentUser.id === sellerId) {
      alert("You cannot follow your own seller profile.");
      return;
    }

    setFollowLoading(true);

    if (followRow) {
      const { error } = await supabase
        .from("seller_followers")
        .delete()
        .eq("id", followRow.id)
        .eq("follower_id", currentUser.id);

      if (error) {
        alert(error.message);
        setFollowLoading(false);
        return;
      }

      setFollowRow(null);
      setFollowersCount((value) => Math.max(value - 1, 0));
      setFollowLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("seller_followers")
      .insert({
        follower_id: currentUser.id,
        seller_id: sellerId,
      })
      .select("id,follower_id,seller_id")
      .single();

    if (error) {
      alert(error.message);
      setFollowLoading(false);
      return;
    }

    setFollowRow(data);
    setFollowersCount((value) => value + 1);

    await createNotification({
      userId: sellerId,
      type: "follower",
      title: "New Follower",
      message: `${
        currentUser.email || "A buyer"
      } started following your seller profile.`,
      linkUrl: "/seller/followers",
    });

    setFollowLoading(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <p className="text-xl font-black text-cyan-300">
          Loading seller profile...
        </p>
      </main>
    );
  }

  if (!seller) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
        <div className="max-w-md rounded-3xl border border-red-400/20 bg-red-400/10 p-8 text-center">
          <h1 className="text-3xl font-black text-red-300">Seller Not Found</h1>

          <Link
            href="/"
            className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-cyan-400 px-6 font-black text-black hover:bg-cyan-300"
          >
            Back to Home
          </Link>
        </div>
      </main>
    );
  }

  const roundedRating =
    averageRating > 0 ? Math.round(averageRating * 10) / 10 : 0;

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <section className="relative overflow-hidden border-b border-white/10 px-8 py-14">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.22),transparent_32%),radial-gradient(circle_at_top_right,rgba(34,197,94,.16),transparent_34%)]" />

        <div className="relative z-10 mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_360px] lg:items-center">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
              Seller Profile
            </p>

            <div className="flex flex-col gap-6 md:flex-row md:items-center">
              <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-cyan-400/30 bg-cyan-400/10">
                {seller.avatar_url ? (
                  <img
                    src={seller.avatar_url}
                    alt={sellerDisplayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-5xl font-black text-cyan-300">
                    {sellerDisplayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              <div>
                <h1 className="text-5xl font-black md:text-7xl">
                  {sellerDisplayName}
                </h1>

                <div className="mt-4 flex flex-wrap gap-3">
                  <span className="rounded-full border border-green-400/20 bg-green-400/10 px-4 py-2 text-sm font-black text-green-300">
                    {seller.seller_status === "approved"
                      ? "Verified Seller"
                      : "Seller"}
                  </span>

                  <span
                    className={`rounded-full border px-4 py-2 text-sm font-black ${sellerReputation.colorClass}`}
                  >
                    {sellerReputation.badge} {sellerReputation.tierLabel}
                  </span>

                  <span className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-sm font-black text-yellow-300">
                    ★ {roundedRating || "0.0"} / 5
                  </span>

                  <span className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm font-bold text-gray-300">
                    {reviews.length} Reviews
                  </span>

                  <span className="rounded-full border border-green-400/20 bg-green-400/10 px-4 py-2 text-sm font-black text-green-300">
                    {followersCount} Followers
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-7 max-w-3xl leading-8 text-gray-300">
              {seller.bio ||
                "Trusted ComePlayers seller offering gaming products and services."}
            </p>

            <div className="mt-5 flex flex-wrap gap-3 text-sm text-gray-400">
              <span>Joined {formatDate(seller.created_at)}</span>
              {seller.discord && <span>Discord: {seller.discord}</span>}
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              {!isOwnProfile && (
                <button
                  onClick={toggleFollow}
                  disabled={followLoading}
                  className={`inline-flex h-12 items-center justify-center rounded-full px-6 font-black transition disabled:opacity-60 ${
                    isFollowing
                      ? "border border-green-400 bg-green-400 text-black hover:bg-green-300"
                      : "border border-green-400 text-green-300 hover:bg-green-400 hover:text-black"
                  }`}
                >
                  {followLoading
                    ? "Updating..."
                    : isFollowing
                      ? "✓ Following"
                      : "+ Follow Seller"}
                </button>
              )}

              <Link
                href="/following"
                className="inline-flex h-12 items-center justify-center rounded-full border border-cyan-400 px-6 font-bold text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
              >
                My Following
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/30">
            <h2 className="text-2xl font-black">Seller Stats</h2>

            <div className="mt-6 grid gap-4">
              <div
                className={`rounded-2xl border p-5 ${sellerReputation.colorClass}`}
              >
                <p className="text-sm opacity-80">Seller Reputation</p>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <p className="text-4xl font-black text-white">
                    {sellerReputation.score}
                    <span className="text-base text-gray-300">/100</span>
                  </p>
                  <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-black">
                    {sellerReputation.badge} {sellerReputation.tierLabel}
                  </span>
                </div>
                <p className="mt-3 text-sm text-gray-300">
                  {sellerReputation.description}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <p className="text-sm text-gray-400">Average Rating</p>
                <p className="mt-1 text-4xl font-black text-yellow-300">
                  {roundedRating || "0.0"}
                </p>
                <p className="mt-1 text-yellow-300">
                  {averageRating > 0
                    ? renderStars(Math.round(averageRating))
                    : "☆☆☆☆☆"}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <p className="text-sm text-gray-400">Completed Orders</p>
                <p className="mt-1 text-3xl font-black text-green-300">
                  {completedOrders}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <p className="text-sm text-gray-400">Active Products</p>
                <p className="mt-1 text-3xl font-black text-cyan-300">
                  {activeProducts.length}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <p className="text-sm text-gray-400">Followers</p>
                <p className="mt-1 text-3xl font-black text-green-300">
                  {followersCount}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-8 py-10 lg:grid-cols-[1fr_420px]">
        <div>
          <h2 className="text-3xl font-black">Seller Products</h2>

          {activeProducts.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.035] p-10 text-center">
              <h3 className="text-2xl font-black">No active products.</h3>
            </div>
          ) : (
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              {activeProducts.map((product) => (
                <Link
                  key={product.id}
                  href={`/product/${product.id}`}
                  className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] transition hover:-translate-y-1 hover:border-cyan-400 hover:bg-cyan-400/10"
                >
                  <div className="flex h-48 items-center justify-center bg-black">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.title || "Product"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-6xl">🎮</span>
                    )}
                  </div>

                  <div className="p-5">
                    <p className="text-xs font-black text-cyan-300">
                      {product.category || "Marketplace"} /{" "}
                      {product.game_name || "Game"}
                    </p>

                    <h3 className="mt-2 line-clamp-2 text-xl font-black group-hover:text-cyan-300">
                      {product.title || "Untitled Product"}
                    </h3>

                    <p className="mt-4 text-2xl font-black text-cyan-300">
                      {formatPrice(product.price)}
                    </p>

                    <p className="mt-2 text-sm text-gray-400">
                      Stock: {product.stock || 0}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <aside className="h-fit space-y-6">
          <div className="rounded-3xl border border-yellow-400/20 bg-yellow-400/10 p-7 shadow-2xl shadow-black/30">
            <h2 className="text-3xl font-black text-yellow-300">Reviews</h2>

            {reviews.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5 text-center">
                <p className="text-gray-400">No reviews yet.</p>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {reviews.slice(0, 8).map((review) => (
                  <div
                    key={review.id}
                    className="rounded-2xl border border-white/10 bg-black/30 p-5"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-lg font-black text-yellow-300">
                        {renderStars(review.rating)}
                      </p>

                      <p className="text-xs text-gray-500">
                        {formatDate(review.created_at)}
                      </p>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-gray-300">
                      {review.review_text || "No written review."}
                    </p>

                    <p className="mt-3 text-xs text-gray-500">
                      Order #{review.order_id}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}
