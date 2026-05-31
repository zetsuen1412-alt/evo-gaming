"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Category = {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
};

type Product = {
  id: number;
  title: string;
  price: string;
  seller: string | null;
  description: string | null;
  category: string | null;
  slug: string | null;
  image_url: string | null;
  stock: number | null;
  status: string | null;
  category_id: number | null;
};

export default function CategoryPage() {
  const params = useParams();
  const slug = String(params.slug);

  const [category, setCategory] = useState<Category | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadPage() {
      setLoading(true);

      const { data: categoryData, error: categoryError } = await supabase
        .from("categories")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      if (categoryError || !categoryData) {
        console.error(categoryError?.message);
        setCategory(null);
        setLoading(false);
        return;
      }

      setCategory(categoryData);

      const { data: allCategories } = await supabase
        .from("categories")
        .select("*")
        .order("id", { ascending: true });

      setCategories(allCategories || []);

      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("category_id", categoryData.id)
        .eq("status", "active")
        .order("id", { ascending: false });

      if (productError) {
        console.error(productError.message);
      }

      setProducts(productData || []);
      setLoading(false);
    }

    if (slug) loadPage();
  }, [slug]);

  const filteredProducts = products.filter((product) =>
    product.title.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <p className="text-xl font-black text-cyan-300">Loading...</p>
      </main>
    );
  }

  if (!category) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <h1 className="text-3xl font-black text-cyan-300">
            Category Not Found
          </h1>
          <p className="mt-4 text-gray-400">
            Category yang kamu buka tidak ditemukan.
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

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <nav className="flex h-20 items-center justify-between border-b border-white/10 bg-[#020617]/90 px-8">
        <Link href="/">
          <img src="/logo.png?v=2" alt="ComePlayers" className="h-16 w-auto" />
        </Link>

        <Link
          href="/"
          className="rounded-full bg-cyan-400 px-5 py-2 font-black text-black"
        >
          Home
        </Link>
      </nav>

      <section className="px-8 py-12">
        <Link href="/" className="font-bold text-cyan-300">
          ← Back to Home
        </Link>

        <div className="mt-8 flex items-center gap-4">
          <div className="text-5xl">{category.icon}</div>
          <div>
            <h1 className="text-5xl font-black">{category.name}</h1>
            <p className="mt-2 text-gray-400">
              {products.length} active products
            </p>
          </div>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search in ${category.name}...`}
          className="mt-8 w-full max-w-xl rounded-2xl border border-white/10 bg-white/10 px-5 py-4 outline-none focus:border-cyan-400"
        />

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8">
              <h2 className="text-2xl font-black">No products found.</h2>
              <p className="mt-3 text-gray-400">
                Belum ada produk aktif di kategori ini.
              </p>
            </div>
          ) : (
            filteredProducts.map((product) => (
              <Link
                key={product.id}
                href={`/product/${product.id}`}
                className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] transition hover:border-cyan-400"
              >
                <div className="h-48 bg-black">
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
                  <p className="text-sm font-bold text-cyan-300">
                    {product.category}
                  </p>

                  <h2 className="mt-3 text-2xl font-black">
                    {product.title}
                  </h2>

                  <p className="mt-3 text-gray-400">
                    {product.description || "No description"}
                  </p>

                  <p className="mt-5 text-2xl font-black text-cyan-300">
                    {product.price}
                  </p>

                  <div className="mt-5 rounded-xl bg-cyan-400 py-3 text-center font-black text-black">
                    View Product
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </main>
  );
}