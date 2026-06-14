"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type SellerProfile = {
  id: string;
  email: string | null;
  seller_name: string | null;
  username: string | null;
};

type Product = {
  id: number;
  title: string;
  description: string | null;
  price: string | number | null;
  stock: number | null;
  image_url: string | null;
  status: string | null;
  category_name: string | null;
  category: string | null;
  created_at: string;
};

type FilterMode = "all" | "active" | "inactive" | "out-of-stock";

function formatPrice(value: string | number | null) {
  const amount = Number(String(value ?? 0).replace(/[^\d]/g, "") || 0);
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function getProductStatus(product: Product) {
  const stock = Number(product.stock || 0);

  if (stock <= 0) {
    return {
      label: "Out Of Stock",
      dotClass: "bg-red-300",
      className: "border-red-400/20 bg-red-500/10 text-red-300",
    };
  }

  if (product.status === "active") {
    return {
      label: "Active",
      dotClass: "bg-emerald-300",
      className: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    };
  }

  return {
    label: "Inactive",
    dotClass: "bg-yellow-300",
    className: "border-yellow-400/20 bg-yellow-400/10 text-yellow-300",
  };
}

export default function SellerProductsPage() {
  const [loading, setLoading] = useState(true);
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/";
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("email", user.email)
        .maybeSingle();

      if (profileError) {
        alert(profileError.message);
        return;
      }

      if (!profile) {
        alert("Profile not found.");
        return;
      }

      setSeller(profile);

      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("seller_id", profile.id)
        .order("created_at", { ascending: false });

      if (error) {
        alert(error.message);
        return;
      }

      setProducts(data || []);
    } catch (error) {
      console.error(error);
      alert("Failed to load products.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteProduct(id: number) {
    if (!confirm("Delete this product?")) return;

    setUpdatingId(id);

    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) {
      alert(error.message);
      setUpdatingId(null);
      return;
    }

    await loadProducts();
    setUpdatingId(null);
  }

  async function toggleStatus(product: Product) {
    setUpdatingId(product.id);

    const nextStatus = product.status === "active" ? "inactive" : "active";

    const { error } = await supabase
      .from("products")
      .update({ status: nextStatus })
      .eq("id", product.id);

    if (error) {
      alert(error.message);
      setUpdatingId(null);
      return;
    }

    await loadProducts();
    setUpdatingId(null);
  }

  const activeProducts = products.filter(
    (product) => product.status === "active" && Number(product.stock || 0) > 0
  ).length;

  const inactiveProducts = products.filter(
    (product) => product.status !== "active"
  ).length;

  const outOfStockProducts = products.filter(
    (product) => Number(product.stock || 0) <= 0
  ).length;

  const totalStock = products.reduce(
    (sum, product) => sum + Number(product.stock || 0),
    0
  );

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !keyword ||
        product.title.toLowerCase().includes(keyword) ||
        (product.description || "").toLowerCase().includes(keyword) ||
        (product.category_name || "").toLowerCase().includes(keyword) ||
        (product.category || "").toLowerCase().includes(keyword);

      if (!matchesSearch) return false;

      if (filter === "active") {
        return product.status === "active" && Number(product.stock || 0) > 0;
      }

      if (filter === "inactive") {
        return product.status !== "active";
      }

      if (filter === "out-of-stock") {
        return Number(product.stock || 0) <= 0;
      }

      return true;
    });
  }, [filter, products, search]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <div className="rounded-3xl border border-cyan-400/20 bg-white/[0.04] px-8 py-6 shadow-2xl shadow-cyan-500/10">
          <p className="text-lg font-black text-cyan-300">
            Loading products...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <section className="mx-auto max-w-7xl px-6 py-8 md:px-8">
        <div className="mb-6 flex items-center gap-3 text-sm text-slate-400">
          <Link href="/seller" className="transition hover:text-cyan-300">
            Seller Dashboard
          </Link>
          <span>/</span>
          <span className="font-bold text-cyan-300">My Products</span>
        </div>

        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/30 md:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.16),transparent_35%),radial-gradient(circle_at_top_right,rgba(59,130,246,.12),transparent_35%)]" />

          <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
            <div className="flex gap-5">
              <div className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-3xl shadow-lg shadow-cyan-500/10 sm:flex">
                📦
              </div>

              <div>
                <p className="mb-3 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-black text-cyan-300">
                  Seller Products
                </p>

                <h1 className="text-4xl font-black tracking-tight md:text-6xl">
                  Product Inventory
                </h1>

                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
                  Manage, edit, publish, pause, and monitor all marketplace
                  listings from one clean inventory dashboard.
                </p>

                <p className="mt-3 text-sm text-slate-500">
                  Seller:{" "}
                  <span className="text-slate-300">
                    {seller?.seller_name ||
                      seller?.username ||
                      seller?.email ||
                      "-"}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/seller"
                className="rounded-2xl border border-white/10 px-5 py-3 font-black text-slate-300 transition hover:bg-white hover:text-black"
              >
                Dashboard
              </Link>

              <Link
                href="/seller/products/new"
                className="rounded-2xl bg-cyan-400 px-5 py-3 font-black text-black shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-300"
              >
                ＋ Add Product
              </Link>
            </div>
          </div>

          <div className="relative z-10 mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {[
              ["📦", "Total Products", products.length, "All listings", "all"],
              ["📈", "Active", activeProducts, "Live listings", "active"],
              ["⏸️", "Inactive", inactiveProducts, "Paused listings", "inactive"],
              [
                "🚫",
                "Out Of Stock",
                outOfStockProducts,
                "No stock listings",
                "out-of-stock",
              ],
              ["🧱", "Total Stock", totalStock, "Across all products", ""],
            ].map(([icon, label, value, desc, mode]) => {
              const isActive = filter === mode;

              return mode ? (
                <button
                  key={label}
                  type="button"
                  onClick={() => setFilter(mode as FilterMode)}
                  className={`rounded-3xl border p-5 text-left transition ${
                    isActive
                      ? "border-cyan-400 bg-cyan-400/10"
                      : "border-white/10 bg-black/20 hover:border-cyan-400/40"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-2xl">
                      {icon}
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">{label}</p>
                      <p className="mt-1 text-3xl font-black text-white">
                        {value}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{desc}</p>
                    </div>
                  </div>
                </button>
              ) : (
                <div
                  key={label}
                  className="rounded-3xl border border-white/10 bg-black/20 p-5"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-2xl">
                      {icon}
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">{label}</p>
                      <p className="mt-1 text-3xl font-black text-cyan-300">
                        {value}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{desc}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_220px]">
          <div className="relative">
            <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-slate-500">
              🔍
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products by title, description, or category..."
              className="w-full rounded-2xl border border-white/10 bg-black/40 py-4 pl-12 pr-5 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
            />
          </div>

          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as FilterMode)}
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-5 py-4 text-white outline-none focus:border-cyan-400"
          >
            <option value="all">All Products</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="out-of-stock">Out Of Stock</option>
          </select>
        </div>

        <section className="mt-6">
          {products.length === 0 ? (
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-12 text-center shadow-2xl shadow-black/30">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-4xl">
                📦
              </div>

              <h2 className="text-3xl font-black">No Products Yet</h2>

              <p className="mt-3 text-slate-400">
                Start selling today by creating your first marketplace listing.
              </p>

              <Link
                href="/seller/products/new"
                className="mt-6 inline-block rounded-2xl bg-cyan-400 px-6 py-3 font-black text-black transition hover:bg-cyan-300"
              >
                Create Product
              </Link>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-12 text-center shadow-2xl shadow-black/30">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-4xl">
                🔎
              </div>

              <h2 className="text-3xl font-black">No Products Found</h2>

              <p className="mt-3 text-slate-400">
                Try another keyword or change the filter.
              </p>

              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
                className="mt-6 inline-block rounded-2xl border border-cyan-400 px-6 py-3 font-black text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
              >
                Reset Filter
              </button>
            </div>
          ) : (
            <div className="grid gap-5">
              {filteredProducts.map((product) => {
                const status = getProductStatus(product);
                const isUpdating = updatingId === product.id;

                return (
                  <article
                    key={product.id}
                    className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/30 transition hover:border-cyan-400/30"
                  >
                    <div className="grid gap-0 lg:grid-cols-[260px_1fr]">
                      <div className="flex h-56 items-center justify-center bg-black/50 lg:h-full">
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

                      <div className="p-6">
                        <div className="grid gap-6 xl:grid-cols-[1fr_260px_1.1fr] xl:items-center">
                          <div>
                            <div className="flex flex-wrap items-center gap-3">
                              <h2 className="text-2xl font-black">
                                {product.title}
                              </h2>

                              <span
                                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black ${status.className}`}
                              >
                                <span
                                  className={`h-2 w-2 rounded-full ${status.dotClass}`}
                                />
                                {status.label}
                              </span>
                            </div>

                            <p className="mt-2 text-sm font-bold text-cyan-300">
                              {product.category_name ||
                                product.category ||
                                "Game Product"}
                            </p>

                            <p className="mt-4 line-clamp-2 max-w-2xl text-sm leading-6 text-slate-400">
                              {product.description ||
                                "No description provided."}
                            </p>

                            <p className="mt-4 text-xs text-slate-600">
                              Created{" "}
                              {product.created_at
                                ? new Date(product.created_at).toLocaleString(
                                    "id-ID"
                                  )
                                : "-"}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                            <p className="text-sm text-slate-400">Price</p>
                            <h3 className="mt-1 text-2xl font-black text-cyan-300">
                              {formatPrice(product.price)}
                            </h3>

                            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-slate-500">Stock</p>
                                <p
                                  className={`mt-1 font-black ${
                                    Number(product.stock || 0) <= 0
                                      ? "text-red-300"
                                      : "text-white"
                                  }`}
                                >
                                  {product.stock || 0}
                                </p>
                              </div>

                              <div>
                                <p className="text-slate-500">Category</p>
                                <p className="mt-1 truncate font-black text-white">
                                  {product.category_name ||
                                    product.category ||
                                    "-"}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap justify-start gap-3 xl:justify-end">
                            <Link
                              href={`/seller/products/${product.id}/edit`}
                              className="rounded-2xl border border-white/10 px-5 py-3 font-black text-white transition hover:bg-white hover:text-black"
                            >
                              ✏ Edit
                            </Link>

                            <Link
                              href={`/product/${product.id}`}
                              className="rounded-2xl border border-cyan-400/30 px-5 py-3 font-black text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
                            >
                              👁 View
                            </Link>

                            <button
                              type="button"
                              onClick={() => toggleStatus(product)}
                              disabled={isUpdating}
                              className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 px-5 py-3 font-black text-yellow-300 transition hover:bg-yellow-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isUpdating
                                ? "Updating..."
                                : product.status === "active"
                                ? "⏸ Pause"
                                : "▶ Activate"}
                            </button>

                            <button
                              type="button"
                              onClick={() => deleteProduct(product.id)}
                              disabled={isUpdating}
                              className="rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-3 font-black text-red-300 transition hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isUpdating ? "Processing..." : "🗑 Delete"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}