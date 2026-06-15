"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCurrency } from "@/components/CurrencyProvider";
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
      className: "bg-red-500/10 text-red-300",
    };
  }

  if (product.status === "active") {
    return {
      label: "Active",
      className: "bg-green-400/10 text-green-300",
    };
  }

  return {
    label: "Inactive",
    className: "bg-yellow-400/10 text-yellow-300",
  };
}

export default function SellerProductsPage() {
  const { formatPrice, currency } = useCurrency();
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
      .update({
        status: nextStatus,
      })
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
        <p className="text-xl font-black text-cyan-300">
          Loading products...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <section className="relative overflow-hidden border-b border-white/10 px-8 py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(37,99,235,.18),transparent_34%)]" />

        <div className="relative z-10 flex flex-col justify-between gap-8 lg:flex-row lg:items-start">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
              Seller Products V2
            </p>

            <h1 className="text-5xl font-black md:text-7xl">My Products</h1>

            <p className="mt-5 max-w-2xl text-gray-300">
              Search, filter, edit, publish, pause, and manage your marketplace
              listings from one seller inventory dashboard.
            </p>

            <p className="mt-3 text-sm text-gray-500">
              Seller:{" "}
              {seller?.seller_name || seller?.username || seller?.email || "-"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/seller"
              className="rounded-full border border-white/10 px-5 py-2 font-bold text-gray-300 transition hover:bg-white hover:text-black"
            >
              Dashboard
            </Link>

            <Link
              href="/seller/products/new"
              className="rounded-full bg-cyan-400 px-5 py-2 font-black text-black transition hover:bg-cyan-300"
            >
              Add Product
            </Link>
          </div>
        </div>
      </section>

      <section className="px-8 py-10">
        <div className="mb-10 grid gap-5 md:grid-cols-5">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-3xl border p-6 text-left shadow-2xl shadow-black/30 transition ${
              filter === "all"
                ? "border-cyan-400 bg-cyan-400/10"
                : "border-white/10 bg-white/[0.035] hover:border-cyan-400/50"
            }`}
          >
            <p className="text-sm font-bold text-gray-400">Total Products</p>
            <h2 className="mt-3 text-4xl font-black text-cyan-300">
              {products.length}
            </h2>
          </button>

          <button
            onClick={() => setFilter("active")}
            className={`rounded-3xl border p-6 text-left shadow-2xl shadow-black/30 transition ${
              filter === "active"
                ? "border-green-400 bg-green-400/10"
                : "border-white/10 bg-white/[0.035] hover:border-green-400/50"
            }`}
          >
            <p className="text-sm font-bold text-gray-400">Active</p>
            <h2 className="mt-3 text-4xl font-black text-green-300">
              {activeProducts}
            </h2>
          </button>

          <button
            onClick={() => setFilter("inactive")}
            className={`rounded-3xl border p-6 text-left shadow-2xl shadow-black/30 transition ${
              filter === "inactive"
                ? "border-yellow-400 bg-yellow-400/10"
                : "border-white/10 bg-white/[0.035] hover:border-yellow-400/50"
            }`}
          >
            <p className="text-sm font-bold text-gray-400">Inactive</p>
            <h2 className="mt-3 text-4xl font-black text-yellow-300">
              {inactiveProducts}
            </h2>
          </button>

          <button
            onClick={() => setFilter("out-of-stock")}
            className={`rounded-3xl border p-6 text-left shadow-2xl shadow-black/30 transition ${
              filter === "out-of-stock"
                ? "border-red-400 bg-red-400/10"
                : "border-white/10 bg-white/[0.035] hover:border-red-400/50"
            }`}
          >
            <p className="text-sm font-bold text-gray-400">Out Of Stock</p>
            <h2 className="mt-3 text-4xl font-black text-red-300">
              {outOfStockProducts}
            </h2>
          </button>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/30">
            <p className="text-sm font-bold text-gray-400">Total Stock</p>
            <h2 className="mt-3 text-4xl font-black text-cyan-300">
              {totalStock}
            </h2>
          </div>
        </div>

        <div className="mb-8 grid gap-4 lg:grid-cols-[1fr_240px]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title, description, or category..."
            className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none placeholder:text-gray-500 focus:border-cyan-400"
          />

          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as FilterMode)}
            className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none focus:border-cyan-400"
          >
            <option value="all">All Products</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="out-of-stock">Out Of Stock</option>
          </select>
        </div>

        {products.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-12 text-center shadow-2xl shadow-black/30">
            <h2 className="text-3xl font-black">No Products Yet</h2>

            <p className="mt-3 text-gray-400">Create your first listing.</p>

            <Link
              href="/seller/products/new"
              className="mt-6 inline-block rounded-full bg-cyan-400 px-6 py-3 font-black text-black transition hover:bg-cyan-300"
            >
              Add Product
            </Link>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-12 text-center shadow-2xl shadow-black/30">
            <h2 className="text-3xl font-black">No Products Found</h2>

            <p className="mt-3 text-gray-400">
              Try another keyword or change the filter.
            </p>

            <button
              onClick={() => {
                setSearch("");
                setFilter("all");
              }}
              className="mt-6 inline-block rounded-full border border-cyan-400 px-6 py-3 font-black text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
            >
              Reset Filter
            </button>
          </div>
        ) : (
          <div className="grid gap-6">
            {filteredProducts.map((product) => {
              const status = getProductStatus(product);
              const isUpdating = updatingId === product.id;

              return (
                <div
                  key={product.id}
                  className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/30"
                >
                  <div className="grid gap-0 lg:grid-cols-[280px_1fr]">
                    <div className="flex h-64 items-center justify-center bg-black/50 lg:h-full">
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
                      <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <h2 className="text-2xl font-black">
                              {product.title}
                            </h2>

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-black ${status.className}`}
                            >
                              {status.label}
                            </span>
                          </div>

                          <p className="mt-2 text-sm font-bold text-cyan-300">
                            {product.category_name ||
                              product.category ||
                              "Game Product"}
                          </p>

                          <p className="mt-4 line-clamp-3 max-w-3xl text-gray-400">
                            {product.description || "No description provided."}
                          </p>

                          <p className="mt-4 text-xs text-gray-600">
                            Created:{" "}
                            {product.created_at
                              ? new Date(product.created_at).toLocaleString(
                                  "id-ID"
                                )
                              : "-"}
                          </p>
                        </div>

                        <div className="grid min-w-[220px] gap-4 rounded-2xl border border-white/10 bg-black/30 p-5">
                          <div>
                            <p className="text-sm text-gray-400">Price</p>
                            <h3 className="mt-1 text-2xl font-black text-cyan-300">
                              {formatPrice(product.price)}
                            </h3>
                          </div>

                          <div>
                            <p className="text-sm text-gray-400">Stock</p>
                            <h3
                              className={`mt-1 text-2xl font-black ${
                                Number(product.stock || 0) <= 0
                                  ? "text-red-300"
                                  : "text-white"
                              }`}
                            >
                              {product.stock || 0}
                            </h3>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 flex flex-wrap gap-3">
                        <Link
                          href={`/seller/products/${product.id}/edit`}
                          className="rounded-xl bg-cyan-400 px-5 py-3 font-black text-black transition hover:bg-cyan-300"
                        >
                          Edit
                        </Link>

                        <Link
                          href={`/product/${product.id}`}
                          className="rounded-xl border border-white/10 px-5 py-3 font-black text-gray-300 transition hover:bg-white hover:text-black"
                        >
                          View Product
                        </Link>

                        <button
                          onClick={() => toggleStatus(product)}
                          disabled={isUpdating}
                          className="rounded-xl bg-yellow-500 px-5 py-3 font-black text-black transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isUpdating
                            ? "Updating..."
                            : product.status === "active"
                            ? "Deactivate"
                            : "Activate"}
                        </button>

                        <button
                          onClick={() => deleteProduct(product.id)}
                          disabled={isUpdating}
                          className="rounded-xl bg-red-500 px-5 py-3 font-black text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isUpdating ? "Processing..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}