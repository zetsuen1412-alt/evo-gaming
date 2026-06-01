"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function SellerProfilePage() {
  const params = useParams();
  const sellerId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [seller, setSeller] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalProducts: 0,
    activeProducts: 0,
    totalSales: 0,
  });

  useEffect(() => {
    loadSeller();
  }, []);

  async function loadSeller() {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", sellerId)
        .single();

      if (!profile) {
        setLoading(false);
        return;
      }

      setSeller(profile);

      const { data: sellerProducts } = await supabase
        .from("products")
        .select("*")
        .eq("seller_id", sellerId)
        .eq("status", "active");

      const { data: orders } = await supabase
        .from("orders")
        .select("*")
        .eq("seller_id", sellerId);

      setProducts(sellerProducts || []);

      setStats({
        totalProducts: sellerProducts?.length || 0,
        activeProducts:
          sellerProducts?.filter((p) => p.status === "active").length || 0,
        totalSales: orders?.length || 0,
      });
    } catch (error) {
      console.error(error);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020b2d] flex items-center justify-center text-cyan-400 text-2xl">
        Loading Seller Profile...
      </div>
    );
  }

  if (!seller) {
    return (
      <div className="min-h-screen bg-[#020b2d] flex items-center justify-center text-white">
        Seller not found
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020b2d] text-white">

      <div className="h-56 bg-gradient-to-r from-cyan-600 via-blue-700 to-indigo-800" />

      <div className="max-w-7xl mx-auto px-6 -mt-20">

        <div className="bg-[#07153f] rounded-3xl p-8 border border-cyan-500/20">

          <div className="flex flex-col md:flex-row gap-6">

            <div className="w-32 h-32 rounded-full bg-cyan-500 flex items-center justify-center text-5xl font-bold">
              {seller.seller_name?.charAt(0)?.toUpperCase()}
            </div>

            <div className="flex-1">

              <div className="flex items-center gap-3 mb-2">

                <h1 className="text-4xl font-bold">
                  {seller.seller_name}
                </h1>

                <span className="bg-green-500 px-3 py-1 rounded-full text-sm font-bold">
                  VERIFIED
                </span>

              </div>

              <p className="text-gray-400 mb-4">
                Trusted ComePlayers Seller
              </p>

              <div className="space-y-2">

                <p>
                  <span className="text-cyan-400">Email:</span>{" "}
                  {seller.email}
                </p>

                {seller.discord && (
                  <p>
                    <span className="text-cyan-400">Discord:</span>{" "}
                    {seller.discord}
                  </p>
                )}

                <p className="text-gray-300">
                  {seller.bio ||
                    "Professional gaming marketplace seller."}
                </p>

              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 my-10">

          <div className="bg-[#07153f] p-6 rounded-2xl">
            <p className="text-gray-400">Total Products</p>
            <h2 className="text-4xl font-bold text-cyan-400">
              {stats.totalProducts}
            </h2>
          </div>

          <div className="bg-[#07153f] p-6 rounded-2xl">
            <p className="text-gray-400">Active Listings</p>
            <h2 className="text-4xl font-bold text-green-400">
              {stats.activeProducts}
            </h2>
          </div>

          <div className="bg-[#07153f] p-6 rounded-2xl">
            <p className="text-gray-400">Total Sales</p>
            <h2 className="text-4xl font-bold text-yellow-400">
              {stats.totalSales}
            </h2>
          </div>

        </div>

        <h2 className="text-3xl font-bold mb-6">
          Seller Products
        </h2>

        {products.length === 0 ? (
          <div className="bg-[#07153f] p-10 rounded-2xl text-center text-gray-400">
            No active products.
          </div>
        ) : (
          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6 pb-20">

            {products.map((product) => (
              <Link
                key={product.id}
                href={`/product/${product.id}`}
                className="bg-[#07153f] rounded-2xl overflow-hidden hover:border-cyan-400 border border-transparent transition"
              >
                <div className="aspect-square bg-black flex items-center justify-center">

                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-5xl">🎮</span>
                  )}

                </div>

                <div className="p-4">

                  <h3 className="font-bold mb-2 line-clamp-2">
                    {product.title}
                  </h3>

                  <p className="text-cyan-400 font-bold text-xl">
                    Rp {Number(product.price).toLocaleString()}
                  </p>

                  <p className="text-gray-400 text-sm mt-2">
                    Stock: {product.stock}
                  </p>

                </div>
              </Link>
            ))}

          </div>
        )}
      </div>
    </div>
  );
}