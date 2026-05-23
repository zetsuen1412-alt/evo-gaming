"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [userEmail, setUserEmail] = useState<string | null>(null);

useEffect(() => {
  async function getUser() {
    const { data } = await supabase.auth.getUser();

    if (data.user) {
      setUserEmail(data.user.email ?? null);
    }
  }

  getUser();
}, []);

async function handleLogout() {
  await supabase.auth.signOut();

  window.location.href = "/";
}

const [products, setProducts] = useState<any[]>([]);
const [search, setSearch] = useState("");
const [selectedCategory, setSelectedCategory] = useState("");

useEffect(() => {
 async function getProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("id,title,price,seller,description");

  console.log("DATA PRODUCTS:", data);
  console.log("ERROR PRODUCTS:", error);

  if (error) {
    alert(error.message);
    return;
  }

  setProducts(data || []);
}
  getProducts();
}, []);
  const categories = [
    "Game Coins",
    "Game Accounts",
    "Gift Cards",
    "In-Game Items",
  ];

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Navbar */}
      <nav className="flex items-center justify-between border-b border-gray-800 px-8 py-5">
        <h1 className="text-3xl font-black text-cyan-400">
          EVO Gaming
        </h1>

        <div className="flex gap-4">
  <a
    href="/seller"
    className="rounded-xl border border-cyan-400 px-5 py-2 text-cyan-400 hover:bg-cyan-400 hover:text-black"
  >
    Jadi Seller
  </a>

  <a
  href="/admin"
  className="rounded-xl border border-purple-400 px-5 py-2 text-purple-400 hover:bg-purple-400 hover:text-black"
>
  Admin
</a>

  {userEmail ? (
    <>
      <div className="rounded-xl border border-gray-700 px-5 py-2 text-gray-300">
        {userEmail}
      </div>

      <button
        onClick={handleLogout}
        className="rounded-xl bg-red-500 px-5 py-2 font-bold text-white"
      >
        Logout
      </button>
    </>
  ) : (
    <>
      <a
        href="/login"
        className="rounded-xl border border-gray-700 px-5 py-2 hover:bg-gray-900"
      >
        Login
      </a>

      <a
        href="/register"
        className="rounded-xl bg-cyan-400 px-5 py-2 font-bold text-black hover:bg-cyan-300"
      >
        Register
      </a>
    </>
  )}
</div>
      </nav>

      {/* Hero */}
      <section className="px-8 py-20">
        <h2 className="max-w-4xl text-6xl font-black leading-tight">
          Buy & Sell Game Digital Products Safely
        </h2>

        <p className="mt-6 max-w-2xl text-lg text-gray-400">
          Marketplace untuk top up game, akun game, item digital,
          gift card, dan kebutuhan gaming lainnya.
        </p>

        {/* Search */}
        <div className="mt-10 flex gap-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari game, item, gift card..."
            className="w-full max-w-2xl rounded-2xl border border-gray-700 bg-gray-900 px-6 py-4 outline-none focus:border-cyan-400"
          />

          <button className="rounded-2xl bg-cyan-400 px-8 font-bold text-black hover:bg-cyan-300">
            Cari
          </button>
        </div>
      </section>

      {/* Categories */}
      <section className="px-8">
        <h3 className="mb-6 text-3xl font-bold">
          Categories
        </h3>

        <div className="grid gap-5 md:grid-cols-4">
          {categories.map((category) => (
  <button
    key={category}
    onClick={() => setSelectedCategory(category)}
    className="rounded-3xl border border-gray-800 bg-gray-900 p-6 text-left transition hover:border-cyan-400"
  >
    <h4 className="text-xl font-bold">
      {category}
    </h4>

    <p className="mt-3 text-gray-400">
      Explore products
    </p>
  </button>
))}
        </div>
      </section>

      {/* Products */}
<section className="px-8 py-20">
  <div className="mb-8 flex items-center justify-between">
    <h3 className="text-3xl font-bold">
      Popular Products
    </h3>
    
    <button
  onClick={() => setSelectedCategory("")}
  className="rounded-xl border border-gray-700 px-4 py-2 text-sm"
>
  Semua Kategori
</button>

    <p className="text-red-400">
  Jumlah produk: {products.length}
</p>
  </div>

  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
    {products
  .filter((product) =>
    product.title.toLowerCase().includes(search.toLowerCase())
  )
  .filter((product) =>
    selectedCategory === "" || product.category === selectedCategory
  )
  .map((product) => (
  <div
    key={product.id}
    className="rounded-3xl border border-gray-800 bg-gray-900 p-6"
  >
    <div className="rounded-xl bg-cyan-400/10 px-3 py-1 text-sm text-cyan-400 w-fit">
      {product.seller}
    </div>

    <h4 className="mt-5 text-2xl font-bold">
      {product.title}
    </h4>

    <p className="mt-3 text-gray-400">
      {product.description}
    </p>

    <p className="mt-6 text-3xl font-black text-cyan-400">
      {product.price}
    </p>

    <a
      href={`/product/${product.id}`}
      className="mt-6 block w-full rounded-2xl bg-cyan-400 py-3 text-center font-bold text-black"
    >
      Buy Now
    </a>
  </div>
))}
  </div>
</section>
    </main>
  );
}