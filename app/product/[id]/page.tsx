"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Product = {
  id: number;
  title: string;
  description: string | null;
  price: string | number | null;
  seller: string | null;
  seller_id: string | null;
  seller_name: string | null;
  category: string | null;
  category_id: number | null;
  game_name: string | null;
  game_category_id: number | null;
  image_url: string | null;
  stock: number | null;
  status: string | null;
  slug: string | null;
  created_at: string;
};

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

type Category = {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
};

type GameMaster = {
  id: number;
  name: string;
  slug: string;
  first_letter: string | null;
  status: string | null;
  image_url: string | null;
};

type WishlistRow = {
  id: number;
  user_id: string;
  product_id: number;
};

function formatPrice(value: string | number | null) {
  const numberValue = Number(value || 0);

  if (!Number.isFinite(numberValue)) {
    return "Rp 0";
  }

  return `Rp ${numberValue.toLocaleString("id-ID")}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("id-ID", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ProductDetailV5WishlistPage() {
  const params = useParams();
  const productId = String(params.id || "");

  const [user, setUser] = useState<User | null>(null);

  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  const [product, setProduct] = useState<Product | null>(null);
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(
    null
  );
  const [category, setCategory] = useState<Category | null>(null);
  const [gameMaster, setGameMaster] = useState<GameMaster | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [wishlistRow, setWishlistRow] = useState<WishlistRow | null>(null);

  const sellerDisplayName = useMemo(() => {
    return (
      sellerProfile?.seller_name ||
      sellerProfile?.username ||
      product?.seller_name ||
      product?.seller ||
      "Unknown Seller"
    );
  }, [sellerProfile, product]);

  const categoryDisplayName = useMemo(() => {
    return category?.name || product?.category || "Marketplace";
  }, [category, product]);

  const gameDisplayName = useMemo(() => {
    return gameMaster?.name || product?.game_name || "-";
  }, [gameMaster, product]);

  const backToGameUrl = useMemo(() => {
    if (!category?.slug || !gameMaster?.slug) {
      return "/";
    }

    return `/categories/${category.slug}/${gameMaster.slug}-${category.slug}`;
  }, [category, gameMaster]);

  useEffect(() => {
    if (productId) {
      loadProduct();
    }
  }, [productId]);

  async function loadProduct() {
    try {
      setLoading(true);

      const { data: userData } = await supabase.auth.getUser();
      const currentUser = userData.user || null;
      setUser(currentUser);

      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("id", Number(productId))
        .maybeSingle();

      if (productError) {
        alert(productError.message);
        setLoading(false);
        return;
      }

      if (!productData) {
        setProduct(null);
        setLoading(false);
        return;
      }

      setProduct(productData);

      if (currentUser) {
        const { data: wishlistData } = await supabase
          .from("wishlists")
          .select("id,user_id,product_id")
          .eq("user_id", currentUser.id)
          .eq("product_id", productData.id)
          .maybeSingle();

        setWishlistRow(wishlistData || null);
      }

      if (productData.seller_id) {
        const { data: sellerData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", productData.seller_id)
          .maybeSingle();

        setSellerProfile(sellerData || null);
      }

      if (productData.category_id) {
        const { data: categoryData } = await supabase
          .from("categories")
          .select("*")
          .eq("id", productData.category_id)
          .maybeSingle();

        setCategory(categoryData || null);
      }

      if (productData.game_category_id) {
        const { data: gameData } = await supabase
          .from("game_master")
          .select("*")
          .eq("id", productData.game_category_id)
          .maybeSingle();

        setGameMaster(gameData || null);
      } else if (productData.game_name) {
        const { data: gameData } = await supabase
          .from("game_master")
          .select("*")
          .ilike("name", productData.game_name)
          .maybeSingle();

        setGameMaster(gameData || null);
      }

      const { data: relatedData } = await supabase
        .from("products")
        .select("*")
        .eq("category_id", productData.category_id)
        .eq("game_category_id", productData.game_category_id)
        .eq("status", "active")
        .neq("id", productData.id)
        .limit(4);

      setRelatedProducts(relatedData || []);
      setLoading(false);
    } catch (error) {
      console.error("Load product detail error:", error);
      alert("Failed to load product detail.");
      setLoading(false);
    }
  }

  async function toggleWishlist() {
    if (!product) return;

    if (!user) {
      alert("Please login before using wishlist.");
      window.location.href = "/";
      return;
    }

    setWishlistLoading(true);

    if (wishlistRow) {
      const { error } = await supabase
        .from("wishlists")
        .delete()
        .eq("id", wishlistRow.id)
        .eq("user_id", user.id);

      if (error) {
        alert(error.message);
        setWishlistLoading(false);
        return;
      }

      setWishlistRow(null);
      setWishlistLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("wishlists")
      .insert({
        user_id: user.id,
        product_id: product.id,
      })
      .select("id,user_id,product_id")
      .single();

    if (error) {
      alert(error.message);
      setWishlistLoading(false);
      return;
    }

    setWishlistRow(data);
    setWishlistLoading(false);
  }

  async function handleBuyNow() {
    if (!product) return;

    if (product.status !== "active") {
      alert("This product is currently unavailable.");
      return;
    }

    if (Number(product.stock || 0) <= 0) {
      alert("This product is out of stock.");
      return;
    }

    try {
      setBuying(true);

      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session?.user) {
        alert("Please login before buying.");
        window.location.href = "/";
        return;
      }

      window.location.href = `/checkout/${product.id}`;
    } catch (error) {
      console.error("Buy product error:", error);
      alert("Failed to continue checkout.");
      setBuying(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <p className="text-xl font-black text-cyan-300">
          Loading product detail...
        </p>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
        <div className="rounded-3xl border border-red-400/20 bg-red-400/10 p-8 text-center">
          <h1 className="text-3xl font-black text-red-300">
            Product not found
          </h1>

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

  const isAvailable =
    product.status === "active" && Number(product.stock || 0) > 0;

  const isWishlisted = Boolean(wishlistRow);

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <section className="relative overflow-hidden border-b border-white/10 px-8 py-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(37,99,235,.18),transparent_34%)]" />

        <div className="relative z-10 mx-auto flex max-w-7xl flex-col justify-between gap-6 lg:flex-row lg:items-start">
          <div>
            <p className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
              {categoryDisplayName} / {gameDisplayName}
            </p>

            <h1 className="mt-5 max-w-5xl text-4xl font-black md:text-6xl">
              {product.title}
            </h1>

            <p className="mt-4 text-gray-400">
              Listed by {sellerDisplayName} · Created{" "}
              {formatDate(product.created_at)}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/wishlist"
              className="w-fit rounded-full border border-pink-400 px-5 py-2 font-bold text-pink-300 transition hover:bg-pink-400 hover:text-black"
            >
              Wishlist
            </Link>

            <Link
              href={backToGameUrl}
              className="w-fit rounded-full border border-cyan-400 px-5 py-2 font-bold text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
            >
              Back to Game
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-8 py-10 lg:grid-cols-[1fr_420px]">
        <div className="space-y-8">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/30">
            <div className="flex h-[420px] items-center justify-center bg-black">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.title}
                  className="h-full w-full object-cover"
                />
              ) : gameMaster?.image_url ? (
                <img
                  src={gameMaster.image_url}
                  alt={gameMaster.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="text-center">
                  <p className="text-8xl">🎮</p>
                  <p className="mt-4 text-gray-500">No product image</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/30">
            <h2 className="text-3xl font-black">Product Description</h2>

            <p className="mt-5 whitespace-pre-line leading-8 text-gray-300">
              {product.description || "No description provided."}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/30">
            <h2 className="text-3xl font-black">Product Information</h2>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <p className="text-sm text-gray-400">Category</p>
                <p className="mt-1 font-black">{categoryDisplayName}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <p className="text-sm text-gray-400">Game</p>
                <p className="mt-1 font-black">{gameDisplayName}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <p className="text-sm text-gray-400">Stock</p>
                <p className="mt-1 font-black">{product.stock || 0}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <p className="text-sm text-gray-400">Status</p>
                <p
                  className={`mt-1 font-black ${
                    product.status === "active"
                      ? "text-green-300"
                      : "text-red-300"
                  }`}
                >
                  {product.status || "unknown"}
                </p>
              </div>
            </div>
          </div>

          {relatedProducts.length > 0 && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/30">
              <h2 className="text-3xl font-black">Related Products</h2>

              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {relatedProducts.map((item) => (
                  <Link
                    key={item.id}
                    href={`/product/${item.id}`}
                    className="overflow-hidden rounded-2xl border border-white/10 bg-black/30 transition hover:border-cyan-400"
                  >
                    <div className="flex h-32 items-center justify-center bg-black">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-4xl">🎮</span>
                      )}
                    </div>

                    <div className="p-4">
                      <h3 className="line-clamp-2 font-black">{item.title}</h3>

                      <p className="mt-2 font-black text-cyan-300">
                        {formatPrice(item.price)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="h-fit space-y-6">
          <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-7 shadow-2xl shadow-black/30">
            <p className="text-sm font-bold text-gray-300">Price</p>

            <h2 className="mt-2 text-5xl font-black text-cyan-300">
              {formatPrice(product.price)}
            </h2>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Availability</span>
                <span
                  className={`font-black ${
                    isAvailable ? "text-green-300" : "text-red-300"
                  }`}
                >
                  {isAvailable ? "Available" : "Unavailable"}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-gray-400">Stock</span>
                <span className="font-black">{product.stock || 0}</span>
              </div>
            </div>

            <button
              onClick={handleBuyNow}
              disabled={!isAvailable || buying}
              className="mt-6 w-full rounded-2xl bg-cyan-400 py-4 text-lg font-black text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {buying ? "Opening Checkout..." : "Buy Now"}
            </button>

            <button
              onClick={toggleWishlist}
              disabled={wishlistLoading}
              className={`mt-4 w-full rounded-2xl border py-4 text-lg font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                isWishlisted
                  ? "border-pink-400 bg-pink-400 text-black hover:bg-pink-300"
                  : "border-pink-400 text-pink-300 hover:bg-pink-400 hover:text-black"
              }`}
            >
              {wishlistLoading
                ? "Updating Wishlist..."
                : isWishlisted
                ? "♥ Remove from Wishlist"
                : "♡ Add to Wishlist"}
            </button>

            <p className="mt-4 text-center text-sm text-gray-400">
              Secure order flow by ComePlayers.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/30">
            <h2 className="text-2xl font-black">Seller Information</h2>

            <div className="mt-5 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-cyan-400/30 bg-cyan-400/10">
                {sellerProfile?.avatar_url ? (
                  <img
                    src={sellerProfile.avatar_url}
                    alt={sellerDisplayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-black text-cyan-300">
                    {sellerDisplayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              <div>
                <p className="text-xl font-black">{sellerDisplayName}</p>
                <p className="text-sm text-green-300">
                  {sellerProfile?.seller_status === "approved"
                    ? "Verified Seller"
                    : "Seller"}
                </p>
              </div>
            </div>

            <p className="mt-5 line-clamp-4 text-sm leading-6 text-gray-400">
              {sellerProfile?.bio ||
                "Trusted ComePlayers seller offering gaming products and services."}
            </p>

            {product.seller_id && (
              <Link
                href={`/seller-profile/${product.seller_id}`}
                className="mt-6 block rounded-2xl border border-cyan-400 px-5 py-3 text-center font-black text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
              >
                View Seller Profile
              </Link>
            )}
          </div>

          <div className="rounded-3xl border border-yellow-400/20 bg-yellow-400/10 p-7">
            <h2 className="text-xl font-black text-yellow-300">
              Buyer Protection
            </h2>

            <p className="mt-3 text-sm leading-6 text-gray-300">
              Always complete transactions through ComePlayers order flow. Do
              not send payment outside the platform.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}