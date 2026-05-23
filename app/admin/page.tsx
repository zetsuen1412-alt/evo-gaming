"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminPage() {
  const [orders, setOrders] = useState<any[]>([]);

  const [userEmail, setUserEmail] = useState<string | null>(null);

  const adminEmail = "evogamingtiga@gmail.com";

  async function getOrders() {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setOrders(data || []);
  }

  async function updateStatus(id: number, status: string) {
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await getOrders();
    alert("Status berhasil diupdate!");
  }

 useEffect(() => {
  async function checkAdmin() {
    const { data } = await supabase.auth.getUser();

    if (!data.user) {
      alert("Anda harus login dulu!");
      window.location.href = "/login";
      return;
    }

    if (data.user.email !== adminEmail) {
      alert("Anda bukan admin!");
      window.location.href = "/";
      return;
    }

    setUserEmail(data.user.email ?? null);

    getOrders();
  }

  checkAdmin();

  const interval = setInterval(() => {
    getOrders();
  }, 1000);

  return () => clearInterval(interval);
}, []);

  return (
    <main className="min-h-screen bg-black px-8 py-10 text-white">
      <a href="/" className="text-cyan-400">
        ← Kembali ke Home
      </a>

      <h1 className="mt-10 text-5xl font-black">Admin Orders</h1>

      <section className="mt-10 space-y-5">
        {orders.map((order) => (
          <div
            key={order.id}
            className="rounded-3xl border border-gray-800 bg-gray-900 p-6"
          >
            <h2 className="text-2xl font-bold">{order.product}</h2>
            <p className="mt-2 text-gray-400">Buyer: {order.buyer}</p>
            <div
  className={`mt-3 inline-block rounded-xl px-4 py-2 text-sm font-bold ${
    order.status === "Selesai"
      ? "bg-green-500 text-white"
      : order.status === "Diproses"
      ? "bg-yellow-400 text-black"
      : order.status === "Dibatalkan"
      ? "bg-red-500 text-white"
      : "bg-gray-700 text-white"
  }`}
>
  {order.status}
</div>

            <p className="mt-4 text-2xl font-black text-cyan-400">
              {order.price}
            </p>

            <div className="mt-5 flex flex-wrap gap-3">

  <button
    onClick={() => updateStatus(order.id, "Menunggu Cek Pembayaran")}
    className="rounded-xl bg-blue-500 px-5 py-2 font-bold text-white"
  >
    Cek Pembayaran
  </button>

  <button
    onClick={() => updateStatus(order.id, "Diproses")}
    className="rounded-xl bg-yellow-400 px-5 py-2 font-bold text-black"
  >
    Diproses
  </button>

  <button
    onClick={() => updateStatus(order.id, "Selesai")}
    className="rounded-xl bg-green-500 px-5 py-2 font-bold text-white"
  >
    Selesai
  </button>

  <button
    onClick={() => updateStatus(order.id, "Dibatalkan")}
    className="rounded-xl bg-red-500 px-5 py-2 font-bold text-white"
  >
    Dibatalkan
  </button>

</div>
          </div>
        ))}
      </section>
    </main>
  );
}