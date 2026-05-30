"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function PaymentPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleUpload() {
    if (!file) {
      alert("Pilih gambar bukti pembayaran dulu.");
      return;
    }

    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      alert("Harus login dulu!");
      window.location.href = "/login";
      return;
    }

    const fileName = `${Date.now()}-${file.name}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(fileName, file);

      console.log("UPLOAD RESULT", uploadData);
      console.log("UPLOAD ERROR", uploadError);

    if (uploadError) {
      alert(uploadError.message);
      setLoading(false);
      return;
    }

    const { data: publicUrl } = supabase.storage
      .from("payment-proofs")
      .getPublicUrl(fileName);

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "Menunggu Cek Pembayaran",
        payment_proof: "Bukti pembayaran sudah diupload",
        payment_image: publicUrl.publicUrl,
      })
      .eq("buyer", userData.user.email)
      .order("id", { ascending: false })
      .limit(1);

    if (updateError) {
      alert(updateError.message);
      setLoading(false);
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

      <section className="mx-auto mt-10 max-w-xl rounded-3xl border border-gray-800 bg-gray-900 p-8">
        <h1 className="text-4xl font-black text-cyan-400">
          Pembayaran QRIS
        </h1>

        <p className="mt-4 text-gray-400">
          Scan QRIS, lalu upload bukti pembayaran.
        </p>

        <img
          src="/qris.jpeg"
          alt="QRIS Payment"
          className="mx-auto mt-8 w-full max-w-sm rounded-2xl bg-white"
        />

        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="mt-8 w-full rounded-2xl border border-gray-700 bg-black px-5 py-4"
        />

        <button
          onClick={handleUpload}
          disabled={loading}
          className="mt-8 w-full rounded-2xl bg-cyan-400 py-4 font-bold text-black hover:bg-cyan-300 disabled:opacity-50"
        >
          {loading ? "Mengirim..." : "Kirim Bukti Pembayaran"}
        </button>
      </section>
    </main>
  );
}