"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  email: string | null;
  username: string | null;
  role: string | null;
  seller_status: string | null;
  seller_name: string | null;
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

type ExistingProduct = {
  id: number;
  title: string | null;
  description: string | null;
  price: string | number | null;
  stock: number | null;
  category: string | null;
  category_id: number | null;
  game_name: string | null;
  game_category_id: number | null;
  seller_id: string | null;
  image_url: string | null;
  slug: string | null;
  status: string | null;
};

type WishlistUser = {
  user_id: string;
};

function createSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function numberPrice(value: string | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(String(value).replace(/[^\d]/g, "") || 0);
}

function formatRupiah(value: string | number | null | undefined) {
  const amount = numberPrice(value);
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

export default function ProductUploadClient() {
  const searchParams = useSearchParams();
  const params = useParams();

  const requestedGameSlug = searchParams.get("game") || "";
  const requestedCategoryValue = searchParams.get("category") || "";

  const rawEditingId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const editingId = rawEditingId ? Number(rawEditingId) : null;
  const isEditMode = Number.isFinite(editingId) && Number(editingId) > 0;

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [existingProduct, setExistingProduct] =
    useState<ExistingProduct | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [games, setGames] = useState<GameMaster[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedGameId, setSelectedGameId] = useState("");

  const [successModal, setSuccessModal] = useState(false);
  const [createdProductLink, setCreatedProductLink] = useState("");

  const selectedCategory = categories.find(
    (category) => String(category.id) === selectedCategoryId
  );

  const selectedGame = games.find((game) => String(game.id) === selectedGameId);

  const productSlug = useMemo(() => {
    if (isEditMode && existingProduct?.slug) return existingProduct.slug;

    const baseSlug = createSlug(title);
    const gameSlug = selectedGame?.slug || "game";

    if (!baseSlug) return "";

    return `${gameSlug}-${baseSlug}`;
  }, [existingProduct?.slug, isEditMode, selectedGame?.slug, title]);

  useEffect(() => {
    initializePage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function initializePage() {
    try {
      setLoading(true);

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        alert(sessionError.message);
        window.location.href = "/";
        return;
      }

      if (!sessionData.session?.user) {
        window.location.href = "/";
        return;
      }

      const currentUser = sessionData.session.user;
      setUser(currentUser);

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (profileError) {
        alert(profileError.message);
        window.location.href = "/";
        return;
      }

      if (!profileData) {
        alert("Profile not found. Please login again.");
        window.location.href = "/";
        return;
      }

      if (profileData.seller_status !== "approved") {
        alert("Seller approval is required to manage products.");
        window.location.href = "/seller/apply";
        return;
      }

      setProfile(profileData);

      const [categoryResult, gameResult] = await Promise.all([
        supabase.from("categories").select("*").order("id", { ascending: true }),
        supabase
          .from("game_master")
          .select("id,name,slug,first_letter,status,image_url")
          .eq("status", "active")
          .order("name", { ascending: true }),
      ]);

      if (categoryResult.error) {
        alert(categoryResult.error.message);
        setLoading(false);
        return;
      }

      if (gameResult.error) {
        alert(gameResult.error.message);
        setLoading(false);
        return;
      }

      const activeCategories = categoryResult.data || [];
      const activeGames = gameResult.data || [];

      setCategories(activeCategories);
      setGames(activeGames);

      if (isEditMode && editingId) {
        const { data: productData, error: productError } = await supabase
          .from("products")
          .select("*")
          .eq("id", editingId)
          .maybeSingle();

        if (productError) {
          alert(productError.message);
          window.location.href = "/seller/products";
          return;
        }

        if (!productData) {
          alert("Product not found.");
          window.location.href = "/seller/products";
          return;
        }

        if (productData.seller_id !== profileData.id) {
          alert("You can only edit your own products.");
          window.location.href = "/seller/products";
          return;
        }

        const product = productData as ExistingProduct;

        setExistingProduct(product);
        setTitle(product.title || "");
        setPrice(String(product.price || ""));
        setStock(String(product.stock ?? 0));
        setDescription(product.description || "");
        setImageUrl(product.image_url || "");

        if (product.category_id) {
          setSelectedCategoryId(String(product.category_id));
        } else if (activeCategories.length > 0) {
          const matchedCategory = activeCategories.find(
            (category) =>
              category.name.toLowerCase() ===
              String(product.category || "").toLowerCase()
          );

          setSelectedCategoryId(
            String((matchedCategory || activeCategories[0]).id)
          );
        }

        if (product.game_category_id) {
          setSelectedGameId(String(product.game_category_id));
        } else if (activeGames.length > 0) {
          const matchedGame = activeGames.find(
            (game) =>
              game.name.toLowerCase() ===
              String(product.game_name || "").toLowerCase()
          );

          setSelectedGameId(String((matchedGame || activeGames[0]).id));
        }

        setLoading(false);
        return;
      }

      if (activeCategories.length > 0) {
        const normalizedRequest = requestedCategoryValue.toLowerCase();
        const requestedCategory = activeCategories.find((category) => {
          return (
            category.slug.toLowerCase() === normalizedRequest ||
            category.name.toLowerCase() === normalizedRequest
          );
        });

        setSelectedCategoryId(
          String((requestedCategory || activeCategories[0]).id)
        );
      }

      if (activeGames.length > 0) {
        const requestedGame = activeGames.find(
          (game) => game.slug.toLowerCase() === requestedGameSlug.toLowerCase()
        );

        setSelectedGameId(String((requestedGame || activeGames[0]).id));
      }

      setLoading(false);
    } catch (error) {
      console.error("Product upload page error:", error);
      alert("Failed to load product page.");
      setLoading(false);
    }
  }

  async function notifyWishlistUsersAfterEdit(
    productId: number,
    oldProduct: ExistingProduct,
    nextPrice: number,
    nextStock: number,
    nextTitle: string
  ) {
    const oldPrice = numberPrice(oldProduct.price);
    const oldStock = Number(oldProduct.stock ?? 0);
    const productPath = `/product/${oldProduct.slug || productId}`;

    const shouldNotifyPriceDrop = oldPrice > 0 && nextPrice < oldPrice;
    const shouldNotifyBackInStock = oldStock <= 0 && nextStock > 0;

    if (!shouldNotifyPriceDrop && !shouldNotifyBackInStock) return;

    const { data: wishlistUsers, error } = await supabase
      .from("wishlists")
      .select("user_id")
      .eq("product_id", productId);

    if (error) {
      console.warn("Wishlist alert lookup failed:", error.message);
      return;
    }

    const userIds = Array.from(
      new Set(
        ((wishlistUsers || []) as WishlistUser[])
          .map((row) => row.user_id)
          .filter(Boolean)
      )
    );

    if (userIds.length === 0) return;

    const notifications = [];

    if (shouldNotifyPriceDrop) {
      notifications.push(
        ...userIds.map((userId) => ({
          user_id: userId,
          type: "wishlist_price_drop",
          title: "🔥 Wishlist Price Drop",
          message: `${nextTitle} turun dari ${formatRupiah(
            oldPrice
          )} menjadi ${formatRupiah(nextPrice)}.`,
          link_url: productPath,
          is_read: false,
        }))
      );
    }

    if (shouldNotifyBackInStock) {
      notifications.push(
        ...userIds.map((userId) => ({
          user_id: userId,
          type: "wishlist_back_in_stock",
          title: "📦 Back In Stock",
          message: `${nextTitle} tersedia kembali. Stok sekarang ${nextStock}.`,
          link_url: productPath,
          is_read: false,
        }))
      );
    }

    if (notifications.length > 0) {
      const { error: notificationError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (notificationError) {
        console.warn(
          "Wishlist notification insert failed:",
          notificationError.message
        );
      }
    }
  }

  async function submitProduct(event: React.FormEvent) {
    event.preventDefault();

    if (!user || !profile) {
      alert("Seller profile not found.");
      return;
    }

    if (!title.trim()) {
      alert("Product title is required.");
      return;
    }

    if (!price.trim()) {
      alert("Product price is required.");
      return;
    }

    if (!description.trim()) {
      alert("Product description is required.");
      return;
    }

    if (!selectedCategory) {
      alert("Please select a category.");
      return;
    }

    if (!selectedGame) {
      alert("Please select a game.");
      return;
    }

    const parsedStock = Number(stock);

    if (!Number.isFinite(parsedStock) || parsedStock < 0) {
      alert("Stock cannot be negative.");
      return;
    }

    if (!isEditMode && parsedStock < 1) {
      alert("Stock must be at least 1.");
      return;
    }

    const parsedPrice = Number(price);

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      alert("Price must be greater than 0.");
      return;
    }

    setSubmitting(true);

    const sellerDisplayName =
      profile.seller_name || profile.username || user.email || "Seller";

    if (isEditMode && editingId) {
      if (!existingProduct) {
        alert("Existing product data not found.");
        setSubmitting(false);
        return;
      }

      const { data: updatedProduct, error } = await supabase
        .from("products")
        .update({
          title: title.trim(),
          description: description.trim(),
          price: parsedPrice,
          stock: parsedStock,
          category: selectedCategory.name,
          category_id: selectedCategory.id,
          game_name: selectedGame.name,
          game_category_id: selectedGame.id,
          seller_name: sellerDisplayName,
          image_url: imageUrl.trim() || selectedGame.image_url || null,
          status:
            parsedStock > 0 ? "active" : existingProduct.status || "active",
        })
        .eq("id", editingId)
        .eq("seller_id", profile.id)
        .select("id")
        .single();

      if (error) {
        alert(`Database Error: ${error.message}`);
        setSubmitting(false);
        return;
      }

      if (updatedProduct?.id) {
        await notifyWishlistUsersAfterEdit(
          updatedProduct.id,
          existingProduct,
          parsedPrice,
          parsedStock,
          title.trim()
        );
      }

      setCreatedProductLink("/seller/products");
      setSuccessModal(true);
      setSubmitting(false);
      return;
    }

    const { data: createdProduct, error } = await supabase
      .from("products")
      .insert({
        title: title.trim(),
        description: description.trim(),
        price: parsedPrice,
        stock: parsedStock,
        category: selectedCategory.name,
        category_id: selectedCategory.id,
        game_name: selectedGame.name,
        game_category_id: selectedGame.id,
        seller: sellerDisplayName,
        seller_id: profile.id,
        seller_name: sellerDisplayName,
        image_url: imageUrl.trim() || selectedGame.image_url || null,
        slug: productSlug || createSlug(title),
        status: "active",
      })
      .select("id")
      .single();

    if (error) {
      alert(`Database Error: ${error.message}`);
      setSubmitting(false);
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (createdProduct?.id && accessToken) {
        await fetch("/api/sellers/followers/notify-new-product", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ productId: createdProduct.id }),
        });
      }
    } catch (notificationError) {
      console.error("Followed seller notification error:", notificationError);
    }

    setCreatedProductLink(
      `/games/${selectedGame.slug}/offers?category=${encodeURIComponent(
        selectedCategory.name
      )}`
    );
    setSuccessModal(true);
    setSubmitting(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <div className="rounded-3xl border border-cyan-400/20 bg-white/[0.04] px-8 py-6 shadow-2xl shadow-cyan-500/10">
          <p className="text-lg font-black text-cyan-300">
            {isEditMode
              ? "Loading product editor..."
              : "Loading product creator..."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      {successModal ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 px-5 backdrop-blur-md">
          <div className="w-full max-w-lg overflow-hidden rounded-[2rem] border border-cyan-400/20 bg-[#07111f] shadow-2xl shadow-cyan-500/20">
            <div className="relative px-8 pt-8">
              <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(34,211,238,.25),transparent_65%)]" />

              <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/15 text-4xl shadow-lg shadow-emerald-500/20">
                ✓
              </div>

              <h2 className="relative mt-6 text-center text-3xl font-black">
                {isEditMode ? "Product Updated" : "Product Created"}
              </h2>

              <p className="relative mt-3 text-center text-sm leading-6 text-slate-400">
                {isEditMode
                  ? "Your product listing has been updated successfully."
                  : "Your product has been published successfully and is now visible in the marketplace."}
              </p>
            </div>

            <div className="px-8 py-6">
              <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
                <div className="flex items-start justify-between gap-5 border-b border-white/10 pb-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                      Product
                    </p>
                    <p className="mt-1 font-black text-white">
                      {title || "Product Listing"}
                    </p>
                  </div>

                  <div className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-300">
                    Active
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Game</span>
                    <span className="text-right font-bold text-white">
                      {selectedGame?.name || "-"}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Category</span>
                    <span className="text-right font-bold text-white">
                      {selectedCategory?.name || "-"}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Price</span>
                    <span className="font-black text-cyan-300">
                      {formatRupiah(price)}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Stock</span>
                    <span className="font-black text-emerald-300">
                      {stock || "0"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-3">
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = createdProductLink || "/seller/products";
                  }}
                  className="rounded-2xl bg-cyan-400 py-4 font-black text-black transition hover:bg-cyan-300"
                >
                  {isEditMode ? "Back to Products" : "View Listing"}
                </button>

                {!isEditMode ? (
                  <button
                    type="button"
                    onClick={() => {
                      setTitle("");
                      setPrice("");
                      setStock("1");
                      setDescription("");
                      setImageUrl("");
                      setSuccessModal(false);
                    }}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] py-4 font-black text-white transition hover:bg-white hover:text-black"
                  >
                    Create Another Product
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <section className="relative overflow-hidden border-b border-white/10 px-6 py-12 md:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(37,99,235,.18),transparent_34%)]" />

        <div className="relative z-10 mx-auto flex max-w-7xl flex-col justify-between gap-8 lg:flex-row lg:items-start">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
              {isEditMode ? "Product Editor" : "Product Upload"}
            </p>

            <h1 className="text-5xl font-black md:text-7xl">
              {isEditMode ? "Edit Product Listing" : "Create Product Listing"}
            </h1>

            <p className="mt-5 max-w-2xl text-gray-300">
              {isEditMode
                ? "Update product details, stock, price, and marketplace placement."
                : "Create a clean, trusted, and ready-to-sell marketplace listing."}
            </p>
          </div>

          <Link
            href="/seller/products"
            className="inline-flex h-12 shrink-0 items-center justify-center rounded-full border border-cyan-400 px-6 font-bold text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
          >
            Back to Products
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-10 md:px-8 lg:grid-cols-[1fr_420px]">
        <form
          onSubmit={submitProduct}
          className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/30"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black">Product Information</h2>
              <p className="mt-2 text-sm text-slate-400">
                Fill in product details clearly to increase buyer trust.
              </p>
            </div>

            <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-300">
              Public Listing
            </div>
          </div>

          {isEditMode ? (
            <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-5">
              <h3 className="font-black text-cyan-300">
                Wishlist Alerts Active
              </h3>
              <p className="mt-2 text-sm text-gray-300">
                If you lower the price or restock this product, buyers who saved
                it to their wishlist will receive a notification automatically.
              </p>
            </div>
          ) : null}

          <div className="mt-7 grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-gray-300">
                Category
              </label>

              <select
                value={selectedCategoryId}
                onChange={(event) => setSelectedCategoryId(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none focus:border-cyan-400"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.icon ? `${category.icon} ` : ""}
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-300">
                Game
              </label>

              <select
                value={selectedGameId}
                onChange={(event) => setSelectedGameId(event.target.value)}
                disabled={games.length === 0}
                className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none focus:border-cyan-400 disabled:opacity-60"
              >
                {games.length === 0 ? (
                  <option value="">No active games found</option>
                ) : (
                  games.map((game) => (
                    <option key={game.id} value={game.id}>
                      {game.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-gray-300">
                Product Title
              </label>

              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Example: Premium Account / Top Up / Rare Item"
                className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none placeholder:text-gray-500 focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-300">
                Price
              </label>

              <input
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="Example: 50000"
                className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none placeholder:text-gray-500 focus:border-cyan-400"
              />
            </div>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-gray-300">
                Stock
              </label>

              <input
                type="number"
                min="0"
                value={stock}
                onChange={(event) => setStock(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-300">
                Product Image URL
              </label>

              <input
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="https://example.com/product-image.jpg"
                className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none placeholder:text-gray-500 focus:border-cyan-400"
              />
            </div>
          </div>

          <div className="mt-5">
            <label className="mb-2 block text-sm font-bold text-gray-300">
              Description
            </label>

            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe product details, delivery process, requirements, and important notes."
              rows={8}
              className="w-full resize-none rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none placeholder:text-gray-500 focus:border-cyan-400"
            />
          </div>

          <div className="mt-7 rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5">
            <h3 className="font-black text-cyan-300">
              Marketplace Placement
            </h3>

            <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-slate-500">Category</p>
                <p className="mt-1 font-black text-white">
                  {selectedCategory?.name || "Category"}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-slate-500">Game</p>
                <p className="mt-1 font-black text-white">
                  {selectedGame?.name || "Game"}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-slate-500">Visibility</p>
                <p className="mt-1 font-black text-emerald-300">Public</p>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || games.length === 0}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl bg-cyan-400 py-4 text-lg font-black text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                {isEditMode ? "Saving Product..." : "Publishing Product..."}
              </>
            ) : isEditMode ? (
              "Save Product"
            ) : (
              "Create Product"
            )}
          </button>
        </form>

        <aside className="h-fit rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/30">
          <h2 className="text-3xl font-black">Preview</h2>

          <div className="mt-7 overflow-hidden rounded-3xl border border-white/10 bg-black/30">
            <div className="flex h-52 items-center justify-center bg-black">
              {imageUrl || selectedGame?.image_url ? (
                <img
                  src={imageUrl || selectedGame?.image_url || ""}
                  alt={title || "Product preview"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <p className="text-6xl">🎮</p>
              )}
            </div>

            <div className="p-5">
              <p className="text-xs font-bold text-cyan-300">
                {selectedCategory?.name || "Category"} /{" "}
                {selectedGame?.name || "Game"}
              </p>

              <h3 className="mt-2 text-2xl font-black">
                {title || "Product Title"}
              </h3>

              <p className="mt-2 text-sm text-gray-400">
                Seller:{" "}
                {profile?.seller_name ||
                  profile?.username ||
                  user?.email ||
                  "Seller"}
              </p>

              <p className="mt-5 text-3xl font-black text-cyan-300">
                {formatRupiah(price)}
              </p>

              <div className="mt-3 inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-300">
                Stock: {stock || "0"}
              </div>

              <p className="mt-4 line-clamp-4 text-sm leading-6 text-gray-300">
                {description ||
                  "Product description will appear here as a preview."}
              </p>
            </div>
          </div>

          <div className="mt-7 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-5">
            <h3 className="font-black text-cyan-300">Product URL Slug</h3>

            <p className="mt-2 break-words text-sm text-gray-300">
              {productSlug || "product-slug-preview"}
            </p>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-5">
            <h3 className="font-black">Listing Path</h3>

            <p className="mt-2 break-words text-sm text-gray-400">
              /games/{selectedGame?.slug || "game"}/offers?category=
              {encodeURIComponent(selectedCategory?.name || "category")}
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}