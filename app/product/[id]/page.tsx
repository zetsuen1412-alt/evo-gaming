"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
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

type GameCategory = {
  id: number;
  name: string;
  slug: string;
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

export default function ProductDetailPage() {
  const params = useParams();
  const productId = String(params.id || "");

  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);

  const [product, setProduct] = useState<Product | null>(null);
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(
    null
  );
  const [gameCategory, setGameCategory] = useState<GameCategory | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);

  const sellerDisplayName = useMemo(() => {
    return (
      sellerProfile?.seller_name ||
      sellerProfile?.username ||
      product?.seller_name ||
      product?.seller ||
      "Unknown Seller"
    );
  }, [sellerProfile, product]);

  const gameDisplayName = useMemo(() => {
    return product?.game_name || gameCategory?.name || "-";
  }, [product, gameCategory]);

  useEffect(() => {
    if (productId) {
      loadProduct();
    }
  }, [productId]);

  async function loadProduct() {
    try {
      setLoading(true);

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

      if (productData.seller_id) {
        const { data: sellerData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", productData.seller_id)
          .maybeSingle();

        setSellerProfile(sellerData || null);
      }

      if (productData.game_category_id) {
        const { data: gameData } = await supabase
          .from("game_categories")
          .select("id,name,slug")
          .eq("id", productData.game_category_id)
          .maybeSingle();

        setGameCategory(gameData || null);

        const { data: relatedData } = await supabase
          .from("products")
          .select("*")
          .eq("game_category_id", productData.game_category_id)
          .eq("status", "active")
          .neq("id", productData.id)
          .limit(4);

        setRelatedProducts(relatedData || []);
      }

      setLoading(false);
    } catch (error) {
      console.error("Load product detail error:", error);
      alert("Failed to load product detail.");
      setLoading(false);
    }
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
          status: "pending",
        })
        .select("*")
        .single();

      if (orderError) {
        alert(`Order Error: ${orderError.message}`);
        setBuying(false);
        return;
      }

      alert("Order created successfully.");
      window.location.href = `/order/${orderData.id}`;
    } catch (error) {
      console.error("Buy product error:", error);
      alert("Failed to create order.");
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
            className="mt-6 inline-block rounded-full bg-cyan-400 px-6 py-3 font-black text-black hover:bg-cyan-300"
          >
            Back to Home
          </Link>
        </div>
      </main>
    );
  }

  const isAvailable =
    product.status === "active" && Number(product.stock || 0) > 0;

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
          href="/"
          className="rounded-full border border-cyan-400 px-5 py-2 font-bold text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
        >
          Back to Home
        </Link>
      </nav>

      <section className="relative overflow-hidden border-b border-white/10 px-8 py-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(37,99,235,.18),transparent_34%)]" />

        <div className="relative z-10 mx-auto max-w-7xl">
          <p className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
            {product.category || "Marketplace"} / {gameDisplayName}
          </p>

          <h1 className="mt-5 max-w-5xl text-4xl font-black md:text-6xl">
            {product.title}
          </h1>

          <p className="mt-4 text-gray-400">
            Listed by {sellerDisplayName} · Created{" "}
            {formatDate(product.created_at)}
          </p>
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
                <p className="mt-1 font-black">{product.category || "-"}</p>
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
              {buying ? "Creating Order..." : "Buy Now"}
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