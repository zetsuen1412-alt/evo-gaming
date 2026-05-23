"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SellerPage() {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [seller, setSeller] = useState("");
  const [description, setDescription] = useState("");

  async function handleAddProduct() {
    const { error } = await supabase.from("products").insert({
      title,
      price,
      seller,
      description,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Produk berhasil ditambahkan!");

    setTitle("");
    setPrice("");
    setSeller("");
    setDescription("");
  }

  return (
    <main className="min-h-screen bg-black px-8 py-10 text-white">
      <a href="/" className="text-cyan-400">
        ← Kembali ke Home
      </a>

      <section className="mx-auto mt-10 max-w-2xl rounded-3xl border border-gray-800 bg-gray-900 p-8">
        <h1 className="text-4xl font-black">Tambah Produk</h1>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nama produk"
          className="mt-8 w-full rounded-2xl border border-gray-700 bg-black px-5 py-4 outline-none focus:border-cyan-400"
        />

        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Harga, contoh: Rp 50.000"
          className="mt-4 w-full rounded-2xl border border-gray-700 bg-black px-5 py-4 outline-none focus:border-cyan-400"
        />

        <input
          value={seller}
          onChange={(e) => setSeller(e.target.value)}
          placeholder="Nama seller"
          className="mt-4 w-full rounded-2xl border border-gray-700 bg-black px-5 py-4 outline-none focus:border-cyan-400"
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Deskripsi produk"
          className="mt-4 h-32 w-full rounded-2xl border border-gray-700 bg-black px-5 py-4 outline-none focus:border-cyan-400"
        />

        <button
          onClick={handleAddProduct}
          className="mt-6 w-full rounded-2xl bg-cyan-400 py-4 font-bold text-black hover:bg-cyan-300"
        >
          Simpan Produk
        </button>
      </section>
    </main>
  );
}