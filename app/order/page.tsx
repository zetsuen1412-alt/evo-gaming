export default function OrderPage() {
  const { formatPrice, currency } = useCurrency();
  return (
    <main className="min-h-screen bg-black px-8 py-10 text-white">
      <a href="/product" className="text-cyan-400">
        ← Kembali ke Produk
      </a>

      <section className="mx-auto mt-10 max-w-3xl rounded-3xl border border-gray-800 bg-gray-900 p-8">
        <h1 className="text-4xl font-black">Checkout Order</h1>

        <div className="mt-8 space-y-4 text-gray-300">
          <p>Produk: Diamond Mobile Legends</p>
          <p>Seller: Top Seller</p>
          <p>Harga: Rp 50.000</p>
          <p>Status: Menunggu Pembayaran</p>
        </div>

        <div className="mt-8">
          <label className="block text-gray-400">
            Masukkan User ID / Catatan Order
          </label>

          <input
            type="text"
            placeholder="Contoh: ID 12345678 Server 1234"
            className="mt-3 w-full rounded-2xl border border-gray-700 bg-black px-5 py-4 outline-none focus:border-cyan-400"
          />
        </div>

        <button className="mt-8 w-full rounded-2xl bg-cyan-400 py-4 font-bold text-black hover:bg-cyan-300">
          Buat Pesanan
        </button>
      </section>
    </main>
  );
}