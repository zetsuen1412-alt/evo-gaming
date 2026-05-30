"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Order = {
  id: number;
  product: string;
  buyer: string;
  price: string;
  status: string;
  payment_proof: string | null;
  payment_image: string | null;
  created_at: string;
};

export default function SellerPage() {
  const [orders, setOrders] = useState<Order[]>([]);

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

  useEffect(() => {
    getOrders();
  }, []);

  async function updateStatus(id: number, status: string) {
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    getOrders();
  }

  return (
    <main className="min-h-screen bg-black px-8 py-10 text-white">
      <a href="/" className="text-cyan-400">
        ← Kembali ke Home
      </a>

      <h1 className="mt-8 text-4xl font-black text-cyan-400">
        Seller Dashboard
      </h1>

      <p className="mt-2 text-gray-400">
        Kelola pesanan masuk dari pembeli.
      </p>

      <section className="mt-10 grid gap-6">
        {orders.length === 0 ? (
          <p className="text-gray-400">Belum ada pesanan.</p>
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              className="rounded-3xl border border-gray-800 bg-gray-900 p-6"
            >
              <div className="flex flex-col justify-between gap-6 md:flex-row">
                <div>
                  <h2 className="text-2xl font-black">
                    {order.product}
                  </h2>

                  <p className="mt-2 text-cyan-400 text-xl font-bold">
                    Rp {order.price}
                  </p>

                  <p className="mt-2 text-gray-400">
                    Buyer: {order.buyer || "-"}
                  </p>

                  <p className="text-gray-400">
                    Status:{" "}
                    <span className="font-bold text-yellow-400">
                      {order.status}
                    </span>
                  </p>

                  {order.payment_proof && (
                    <p className="mt-2 text-sm text-green-400">
                      {order.payment_proof}
                    </p>
                  )}

                  {order.payment_image && (
                    <div className="mt-4">
                      <p className="mb-2 font-bold text-cyan-400">
                        Bukti Pembayaran
                      </p>

                      <a
                        href={order.payment_image}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          src={order.payment_image}
                          alt="Bukti Pembayaran"
                          className="w-64 rounded-xl border border-gray-700 hover:opacity-80"
                        />
                      </a>
                    </div>
                  )}

                  <p className="mt-3 text-sm text-gray-500">
                    Order ID: #{order.id}
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() =>
                      updateStatus(order.id, "Menunggu Cek Pembayaran")
                    }
                    className="rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black"
                  >
                    Menunggu Cek
                  </button>

                  <button
                    onClick={() => updateStatus(order.id, "Diproses")}
                    className="rounded-xl bg-blue-500 px-5 py-3 font-bold text-white"
                  >
                    Diproses
                  </button>

                  <button
                    onClick={() => updateStatus(order.id, "Selesai")}
                    className="rounded-xl bg-green-500 px-5 py-3 font-bold text-white"
                  >
                    Selesai
                  </button>

                  <button
                    onClick={() => updateStatus(order.id, "Dibatalkan")}
                    className="rounded-xl bg-red-500 px-5 py-3 font-bold text-white"
                  >
                    Batalkan
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}