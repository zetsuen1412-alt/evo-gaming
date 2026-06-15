"use client";

import { useCurrency } from "@/components/CurrencyProvider";
import { supabase } from "@/lib/supabase";

export default function ProductPage() {
  const { formatPrice, currency } = useCurrency();
  async function handleBuy() {
    const { data } = await supabase.auth.getUser();

    if (!data.user) {
      alert("Harus login dulu!");
      return;
    }

    const { error } = await supabase
      .from("orders")
      .insert({
        product: "Diamond Mobile Legends",
        buyer: data.user.email,
        price: "{currency} 50.000",
        status: "Menunggu Pembayaran",
      });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Order berhasil dibuat!");
  }

  return (
    <main className="min-h-screen bg-black px-8 py-10 text-white">
      <a href="/" className="text-cyan-400">
        ← Kembali
      </a>

      <section className="mx-auto mt-10 max-w-3xl rounded-3xl border border-gray-800 bg-gray-900 p-8">
        <h1 className="text-5xl font-black">
          Diamond Mobile Legends
        </h1>

        <p className="mt-6 text-lg text-gray-400">
          Top up ML instant delivery murah dan aman.
        </p>

        <p className="mt-8 text-4xl font-black text-cyan-400">
          {currency} 50.000
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