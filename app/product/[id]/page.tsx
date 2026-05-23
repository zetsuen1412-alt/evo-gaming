"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ProductPage() {
  const params = useParams();
  const [product, setProduct] = useState<any>(null);

  useEffect(() => {
    async function getProduct() {
      const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", Number(params.id))
     .single();

      if (error) {
        alert(error.message);
        return;
      }

      setProduct(data);
    }

    getProduct();
  }, [params.id]);

  async function handleBuy() {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      alert("Harus login dulu!");
      return;
    }

    const { error } = await supabase.from("orders").insert({
      product: product.title,
      buyer: userData.user.email,
      price: product.price,
      status: "Menunggu Pembayaran",
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Order berhasil dibuat! Lanjut ke pembayaran.");
window.location.href = "/payment";
  }

  if (!product) {
    return (
      <main className="min-h-screen bg-black text-white p-10">
        Loading...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-8 py-10 text-white">
      <a href="/" className="text-cyan-400">
        ← Kembali
      </a>

      <section className="mx-auto mt-10 max-w-3xl rounded-3xl border border-gray-800 bg-gray-900 p-8">
        <h1 className="text-5xl font-black">
          {product.title}
        </h1>

        <p className="mt-6 text-lg text-gray-400">
          {product.description}
        </p>

        <p className="mt-8 text-4xl font-black text-cyan-400">
          {product.price}
        </p>

        <p className="mt-4 text-gray-500">
          Seller: {product.seller}
        </p>

        <button
          onClick={handleBuy}
          className="mt-10 w-full rounded-2xl bg-cyan-400 py-5 text-xl font-black text-black hover:bg-cyan-300"
        >
          Beli Sekarang
        </button>
      </section>
    </main>
  );
}