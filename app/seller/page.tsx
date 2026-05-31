"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Category = {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
};

type Product = {
  id: number;
  created_at: string;
  title: string;
  price: string;
  seller: string | null;
  seller_id: string | null;
  description: string | null;
  category: string | null;
  slug: string | null;
  image_url: string | null;
  stock: number | null;
  status: string | null;
  category_id: number | null;
};

export default function SellerPage() {
  const [user, setUser] = useState<User | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [stock, setStock] = useState("1");
  const [status, setStatus] = useState("active");

  function makeSlug(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setPrice("");
    setDescription("");
    setCategoryId("");
    setImageUrl("");
    setStock("1");
    setStatus("active");
  }

  async function getCategories() {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setCategories(data || []);
  }

  async function getProducts(userId: string) {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("seller_id", userId)
      .order("id", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setProducts(data || []);
  }

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();

    if (!user) return;

    if (!title || !price || !categoryId) {
      alert("Title, price, dan category wajib diisi.");
      return;
    }

    const selectedCategory = categories.find(
      (category) => category.id === Number(categoryId)
    );

    if (!selectedCategory) {
      alert("Category tidak valid.");
      return;
    }

    setSaving(true);

    const productData = {
      title,
      price,
      description,
      category: selectedCategory.name,
      category_id: selectedCategory.id,
      slug: makeSlug(title),
      image_url: imageUrl || null,
      stock: Number(stock) || 0,
      status,
      seller: user.email || "Unknown Seller",
      seller_id: user.id,
    };

    if (editingId) {
      const { error } = await supabase
        .from("products")
        .update(productData)
        .eq("id", editingId)
        .eq("seller_id", user.id);

      if (error) {
        alert(error.message);
        setSaving(false);
        return;
      }

      alert("Product berhasil diupdate.");
    } else {
      const { error } = await supabase.from("products").insert(productData);

      if (error) {
        alert(error.message);
        setSaving(false);
        return;
      }

      alert("Product berhasil ditambahkan.");
    }

    resetForm();
    await getProducts(user.id);
    setSaving(false);
  }

  function handleEditProduct(product: Product) {
    setEditingId(product.id);
    setTitle(product.title || "");
    setPrice(product.price || "");
    setDescription(product.description || "");
    setCategoryId(product.category_id ? String(product.category_id) : "");
    setImageUrl(product.image_url || "");
    setStock(product.stock ? String(product.stock) : "0");
    setStatus(product.status || "active");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDeleteProduct(productId: number) {
    if (!user) return;

    const confirmDelete = confirm("Yakin ingin menghapus product ini?");
    if (!confirmDelete) return;

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId)
      .eq("seller_id", user.id);

    if (error) {
      alert(error.message);
      return;
    }

    await getProducts(user.id);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        setUser(null);
        setLoading(false);
        return;
      }

      setUser(data.user);
      await getCategories();
      await getProducts(data.user.id);
      setLoading(false);
    }

    init();
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="rounded-3xl border border-white/10 bg-gray-900 p-8 text-center">
          <p className="text-xl font-bold text-cyan-400">
            Loading seller dashboard...
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
        <div className="max-w-md rounded-3xl border border-white/10 bg-gray-900 p-8 text-center shadow-2xl">
          <h1 className="text-3xl font-black text-cyan-400">
            Login Required
          </h1>

          <p className="mt-4 text-gray-300">
            Kamu harus login terlebih dahulu untuk membuka Seller Dashboard.
          </p>

          <Link
            href="/"
            className="mt-6 inline-block rounded-full bg-cyan-400 px-6 py-3 font-bold text-black hover:bg-cyan-300"
          >
            Kembali ke Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-8 py-8 text-white">
      <header className="mb-10 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <Link href="/" className="text-cyan-400 hover:text-cyan-300">
            ← Kembali ke Home
          </Link>

          <h1 className="mt-6 text-4xl font-black text-cyan-400">
            Seller Dashboard
          </h1>

          <p className="mt-2 text-gray-400">
            Upload dan kelola product milik seller yang sedang login.
          </p>

          <p className="mt-2 text-sm text-gray-500">
            Login sebagai: {user.email}
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="rounded-full border border-white/20 px-6 py-3 font-bold text-white transition hover:bg-white hover:text-black"
        >
          Logout
        </button>
      </header>

      <section className="mb-8 grid gap-5 md:grid-cols-4">
        <div className="rounded-3xl border border-white/10 bg-gray-900 p-5">
          <p className="text-sm text-gray-400">Total Products</p>
          <p className="mt-2 text-3xl font-black text-cyan-400">
            {products.length}
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-gray-900 p-5">
          <p className="text-sm text-gray-400">Active</p>
          <p className="mt-2 text-3xl font-black text-green-400">
            {products.filter((product) => product.status === "active").length}
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-gray-900 p-5">
          <p className="text-sm text-gray-400">Draft</p>
          <p className="mt-2 text-3xl font-black text-yellow-400">
            {products.filter((product) => product.status === "draft").length}
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-gray-900 p-5">
          <p className="text-sm text-gray-400">Stock Total</p>
          <p className="mt-2 text-3xl font-black text-blue-400">
            {products.reduce((total, product) => total + (product.stock || 0), 0)}
          </p>
        </div>
      </section>

      <section className="mb-10 rounded-3xl border border-white/10 bg-gray-900 p-6 shadow-2xl">
        <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-black text-white">
              {editingId ? "Edit Product" : "Upload Product"}
            </h2>
            <p className="text-gray-400">
              Product akan otomatis terhubung dengan akun seller kamu.
            </p>
          </div>

          {editingId && (
            <button
              onClick={resetForm}
              className="rounded-full border border-white/20 px-5 py-2 font-bold hover:bg-white hover:text-black"
            >
              Cancel Edit
            </button>
          )}
        </div>

        <form onSubmit={handleSaveProduct} className="grid gap-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-gray-300">
                Product Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Steam Account Prime"
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-300">
                Price
              </label>
              <input
                type="text"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Contoh: Rp.100.000"
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-bold text-gray-300">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 outline-none focus:border-cyan-400"
              >
                <option value="">Pilih Category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-300">
                Stock
              </label>
              <input
                type="number"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-300">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 outline-none focus:border-cyan-400"
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="sold_out">Sold Out</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-gray-300">
              Image URL
            </label>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-gray-300">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Deskripsi product..."
              rows={5}
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 outline-none focus:border-cyan-400"
            />
          </div>

          <button
            disabled={saving}
            className="rounded-2xl bg-cyan-400 px-6 py-4 font-black text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving
              ? "Saving..."
              : editingId
              ? "Update Product"
              : "Upload Product"}
          </button>
        </form>
      </section>

      <section className="grid gap-6">
        <h2 className="text-3xl font-black">My Products</h2>

        {products.length === 0 ? (
          <div className="rounded-3xl border border-gray-800 bg-gray-900 p-8">
            <h3 className="text-2xl font-black text-white">
              Belum ada product.
            </h3>
            <p className="mt-3 text-gray-400">
              Upload product pertama kamu dari form di atas.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <div
                key={product.id}
                className="overflow-hidden rounded-3xl border border-white/10 bg-gray-900 shadow-xl"
              >
                <div className="h-44 bg-black">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-600">
                      No Image
                    </div>
                  )}
                </div>

                <div className="p-6">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-300">
                      {product.category || "No Category"}
                    </span>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        product.status === "active"
                          ? "bg-green-400/10 text-green-300"
                          : product.status === "draft"
                          ? "bg-yellow-400/10 text-yellow-300"
                          : "bg-red-400/10 text-red-300"
                      }`}
                    >
                      {product.status}
                    </span>
                  </div>

                  <h3 className="text-xl font-black">{product.title}</h3>

                  <p className="mt-2 text-lg font-bold text-cyan-400">
                    {product.price}
                  </p>

                  <p className="mt-3 line-clamp-3 text-sm text-gray-400">
                    {product.description || "No description"}
                  </p>

                  <p className="mt-4 text-sm text-gray-500">
                    Stock: {product.stock ?? 0}
                  </p>

                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleEditProduct(product)}
                      className="rounded-xl bg-blue-500 px-4 py-3 font-bold text-white hover:bg-blue-400"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => handleDeleteProduct(product.id)}
                      className="rounded-xl bg-red-500 px-4 py-3 font-bold text-white hover:bg-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}