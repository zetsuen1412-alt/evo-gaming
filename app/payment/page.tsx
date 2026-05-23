"use client";

import { supabase } from "@/lib/supabase";

export default function PaymentPage() {
  async function handleUpload() {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      alert("Harus login dulu!");
      window.location.href = "/login";
      return;
    }

    const { error } = await supabase
      .from("orders")
      .update({
        status: "Menunggu Cek Pembayaran",
        payment_proof: "Bukti pembayaran sudah diupload",
      })
      .eq("buyer", userData.user.email)
      .order("id", { ascending: false })
      .limit(1);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Bukti pembayaran berhasil dikirim.");
    window.location.href = "/";
  }

  return (
    <main className="min-h-screen bg-black px-8 py-10 text-white">
      <a href="/" className="text-cyan-400">
        ← Kembali ke Home
      </a>

      <section className="mx-auto mt-10 max-w-xl rounded-3xl border border-gray-800 bg-gray-900 p-8 text-center">
        <h1 className="text-4xl font-black text-cyan-400">
          Pembayaran QRIS
        </h1>

        <p className="mt-4 text-gray-400">
          Scan QRIS, lalu upload bukti pembayaran.
        </p>

        <img
          src="/qris.jpeg"
          alt="QRIS Payment"
          className="mx-auto mt-8 w-full max-w-sm rounded-2xl bg-white p-3"
        />

        <input
          type="file"
          accept="image/*"
          className="mt-8 w-full rounded-2xl border border-gray-700 bg-black px-5 py-4"
        />

        <button
          onClick={handleUpload}
          className="mt-8 w-full rounded-2xl bg-cyan-400 py-4 font-bold text-black"
        >
          Kirim Bukti Pembayaran
        </button>
      </section>
    </main>
  );
}