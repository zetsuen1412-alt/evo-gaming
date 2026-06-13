"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Product = Record<string, any>;

type Profile = {
  id: string;
  email?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  role?: string | null;
};

function formatPrice(value: unknown) {
  const price = Number(value || 0);
  if (!Number.isFinite(price)) return "Rp 0";
  return `Rp ${price.toLocaleString("id-ID")}`;
}

function getProductTitle(product?: Product | null) {
  return (
    product?.title ||
    product?.name ||
    product?.product ||
    product?.product_name ||
    "Product"
  );
}

function getProductDescription(product?: Product | null) {
  return (
    product?.description ||
    product?.details ||
    product?.product_description ||
    product?.short_description ||
    "No description available."
  );
}

function getProductPrice(product?: Product | null) {
  return product?.price || product?.total_price || product?.amount || 0;
}

function getProductImage(product?: Product | null) {
  return (
    product?.image_url ||
    product?.thumbnail_url ||
    product?.image ||
    product?.product_image ||
    product?.main_image ||
    null
  );
}

function getProductSellerId(product?: Product | null) {
  return (
    product?.seller_id ||
    product?.user_id ||
    product?.owner_id ||
    product?.profile_id ||
    null
  );
}

function getSellerName(profile?: Profile | null) {
  return profile?.username || profile?.email || "Seller";
}

function avatarLetter(profile?: Profile | null) {
  return getSellerName(profile).slice(0, 1).toUpperCase();
}

export default function ProductDetailPage() {
  const params = useParams();
  const productId = Number(params?.id);

  const [user, setUser] = useState<User | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [seller, setSeller] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);

  const sellerId = useMemo(() => getProductSellerId(product), [product]);
  const title = useMemo(() => getProductTitle(product), [product]);
  const description = useMemo(() => getProductDescription(product), [product]);
  const price = useMemo(() => getProductPrice(product), [product]);
  const image = useMemo(() => getProductImage(product), [product]);

  async function loadProduct() {
    setLoading(true);

    const { data: authData } = await supabase.auth.getUser();
    setUser(authData.user || null);

    const { data: productData, error: productError } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
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

    setProduct(productData as Product);

    const foundSellerId = getProductSellerId(productData);

    if (foundSellerId) {
      const { data: sellerData } = await supabase
        .from("profiles")
        .select("id,email,username,avatar_url,role")
        .eq("id", foundSellerId)
        .maybeSingle();

      setSeller((sellerData || null) as Profile | null);
    }

    setLoading(false);
  }

  async function handleChatSeller() {
    if (!product) return;

    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      alert("Please login first using the Login / Signup button.");
      return;
    }

    const currentUser = authData.user;
    const currentSellerId = getProductSellerId(product);

    if (!currentSellerId) {
      alert("Seller ID not found for this product.");
      return;
    }

    if (currentSellerId === currentUser.id) {
      alert("You cannot chat with yourself on your own product.");
      return;
    }

    setChatLoading(true);

    const { data: existingRoom, error: existingError } = await supabase
      .from("chat_rooms")
      .select("*")
      .eq("buyer_id", currentUser.id)
      .eq("seller_id", currentSellerId)
      .eq("product_id", productId)
      .is("order_id", null)
      .maybeSingle();

    if (existingError) {
      alert(existingError.message);
      setChatLoading(false);
      return;
    }

    if (existingRoom?.id) {
      window.location.href = `/messages?room=${existingRoom.id}`;
      return;
    }

    const firstMessage = `Halo kak, produk "${getProductTitle(product)}" masih tersedia?`;

    const { data: newRoom, error: roomError } = await supabase
      .from("chat_rooms")
      .insert({
        buyer_id: currentUser.id,
        seller_id: currentSellerId,
        product_id: productId,
        order_id: null,
        last_message: firstMessage,
        last_message_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (roomError) {
      alert(roomError.message);
      setChatLoading(false);
      return;
    }

    const { error: messageError } = await supabase.from("chat_messages").insert({
      room_id: newRoom.id,
      sender_id: currentUser.id,
      receiver_id: currentSellerId,
      message: firstMessage,
      is_read: false,
    });

    if (messageError) {
      alert(messageError.message);
      setChatLoading(false);
      return;
    }

    window.location.href = `/messages?room=${newRoom.id}`;
  }

  useEffect(() => {
    if (!Number.isFinite(productId)) {
      setLoading(false);
      return;
    }

    loadProduct();
  }, [productId]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <p className="text-xl font-black text-cyan-300">Loading product...</p>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
        <div className="max-w-md rounded-3xl border border-red-400/30 bg-red-400/10 p-8 text-center">
          <h1 className="text-3xl font-black text-red-300">Product Not Found</h1>
          <p className="mt-4 text-gray-300">This product does not exist or was removed.</p>
          <Link
            href="/"
            className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-cyan-400 px-6 font-black text-black hover:bg-cyan-300"
          >
            Back to Marketplace
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <section className="border-b border-white/10 px-6 py-10">
        <div className="mx-auto max-w-7xl">
          <Link href="/" className="text-sm font-black text-cyan-300 hover:text-cyan-200">
            ← Back to Marketplace
          </Link>

          <div className="mt-8 grid gap-8 lg:grid-cols-[520px_1fr]">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0b1020]">
              {image ? (
                <img src={image} alt={title} className="h-[420px] w-full object-cover" />
              ) : (
                <div className="flex h-[420px] w-full items-center justify-center bg-cyan-400/5 text-7xl">
                  🎮
                </div>
              )}
            </div>

            <div>
              <p className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
                Product Detail
              </p>

              <h1 className="mt-5 text-4xl font-black leading-tight md:text-6xl">
                {title}
              </h1>

              <p className="mt-5 text-4xl font-black text-green-300">
                {formatPrice(price)}
              </p>

              <p className="mt-5 max-w-2xl whitespace-pre-wrap leading-7 text-gray-300">
                {description}
              </p>

              <div className="mt-8 rounded-3xl border border-white/10 bg-[#0b1020] p-5">
                <p className="text-sm font-black uppercase tracking-widest text-gray-500">
                  Seller
                </p>

                <div className="mt-4 flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-cyan-400 font-black text-black">
                    {seller?.avatar_url ? (
                      <img src={seller.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      avatarLetter(seller)
                    )}
                  </div>

                  <div>
                    <p className="font-black">{getSellerName(seller)}</p>
                    <p className="text-sm text-green-300">● Online</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={handleChatSeller}
                  disabled={chatLoading}
                  className="h-14 rounded-2xl bg-cyan-400 px-8 font-black text-black hover:bg-cyan-300 disabled:opacity-60"
                >
                  {chatLoading ? "Opening Chat..." : "Chat Seller"}
                </button>

                <Link
                  href={`/checkout?product=${productId}`}
                  className="inline-flex h-14 items-center justify-center rounded-2xl bg-green-400 px-8 font-black text-black hover:bg-green-300"
                >
                  Buy Now
                </Link>

                <Link
                  href="/messages"
                  className="inline-flex h-14 items-center justify-center rounded-2xl border border-white/10 px-8 font-black text-gray-200 hover:bg-white hover:text-black"
                >
                  Open Messages
                </Link>
              </div>

              {!user && (
                <p className="mt-4 text-sm text-yellow-300">
                  Login dulu untuk chat seller atau membeli produk.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
