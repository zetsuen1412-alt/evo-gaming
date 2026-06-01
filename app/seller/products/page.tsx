"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function SellerProductsPage() {
  const [loading, setLoading] = useState(true);
  const [seller, setSeller] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        location.href = "/login";
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("email", user.email)
        .single();

      if (!profile) {
        alert("Profile not found");
        return;
      }

      setSeller(profile);

      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("seller_id", profile.id)
        .order("created_at", { ascending: false });

      setProducts(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function deleteProduct(id: number) {
    if (!confirm("Delete this product?")) return;

    await supabase.from("products").delete().eq("id", id);

    loadProducts();
  }

  async function toggleStatus(product: any) {
    const nextStatus =
      product.status === "active" ? "inactive" : "active";

    await supabase
      .from("products")
      .update({
        status: nextStatus,
      })
      .eq("id", product.id);

    loadProducts();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020b2d] flex items-center justify-center text-cyan-400 text-2xl">
        Loading Products...
      </div>
    );
  }

  const activeProducts = products.filter(
    (p) => p.status === "active"
  ).length;

  const inactiveProducts = products.filter(
    (p) => p.status !== "active"
  ).length;

  const totalStock = products.reduce(
    (sum, p) => sum + Number(p.stock || 0),
    0
  );

  return (
    <div className="min-h-screen bg-[#020b2d] text-white">

      <div className="max-w-7xl mx-auto px-8 py-10">

        {/* HEADER */}

        <div className="flex justify-between items-center mb-10">

          <div>
            <h1 className="text-5xl font-bold">
              My Products
            </h1>

            <p className="text-gray-400 mt-2">
              Seller: {seller?.seller_name}
            </p>
          </div>

          <div className="flex gap-3">

            <Link
              href="/seller"
              className="px-5 py-3 bg-[#07153f] rounded-xl"
            >
              Dashboard
            </Link>

            <Link
              href="/seller/products/new"
              className="px-5 py-3 bg-cyan-500 text-black font-bold rounded-xl"
            >
              Add Product
            </Link>

          </div>
        </div>

        {/* STATS */}

        <div className="grid md:grid-cols-4 gap-5 mb-10">

          <div className="bg-[#07153f] rounded-xl p-5">
            <p className="text-gray-400">Total Products</p>
            <h2 className="text-4xl font-bold text-cyan-400">
              {products.length}
            </h2>
          </div>

          <div className="bg-[#07153f] rounded-xl p-5">
            <p className="text-gray-400">Active</p>
            <h2 className="text-4xl font-bold text-green-400">
              {activeProducts}
            </h2>
          </div>

          <div className="bg-[#07153f] rounded-xl p-5">
            <p className="text-gray-400">Inactive</p>
            <h2 className="text-4xl font-bold text-red-400">
              {inactiveProducts}
            </h2>
          </div>

          <div className="bg-[#07153f] rounded-xl p-5">
            <p className="text-gray-400">Total Stock</p>
            <h2 className="text-4xl font-bold text-yellow-400">
              {totalStock}
            </h2>
          </div>

        </div>

        {/* PRODUCTS */}

        {products.length === 0 ? (
          <div className="bg-[#07153f] rounded-xl p-10 text-center">
            <h2 className="text-3xl font-bold mb-2">
              No Products Yet
            </h2>

            <p className="text-gray-400 mb-6">
              Create your first listing.
            </p>

            <Link
              href="/seller/products/new"
              className="bg-cyan-500 text-black px-6 py-3 rounded-xl font-bold"
            >
              Add Product
            </Link>
          </div>
        ) : (

          <div className="grid md:grid-cols-2 gap-6">

            {products.map((product) => (

              <div
                key={product.id}
                className="bg-[#07153f] rounded-2xl overflow-hidden border border-cyan-900"
              >

                {/* IMAGE */}

                <div className="h-56 bg-black">

                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-7xl">
                      🎮
                    </div>
                  )}

                </div>

                {/* CONTENT */}

                <div className="p-6">

                  <div className="flex justify-between mb-4">

                    <div>

                      <h2 className="text-2xl font-bold">
                        {product.title}
                      </h2>

                      <p className="text-cyan-400">
                        {product.category_name ||
                          product.category ||
                          "Game Product"}
                      </p>

                    </div>

                    <div>

                      {product.status === "active" ? (
                        <span className="bg-green-500 text-black px-4 py-1 rounded-full font-bold">
                          Active
                        </span>
                      ) : (
                        <span className="bg-red-500 text-white px-4 py-1 rounded-full font-bold">
                          Inactive
                        </span>
                      )}

                    </div>

                  </div>

                  <p className="text-gray-300 mb-5 line-clamp-2">
                    {product.description}
                  </p>

                  <div className="grid grid-cols-2 gap-5 mb-6">

                    <div>
                      <p className="text-gray-400 text-sm">
                        Price
                      </p>

                      <h3 className="text-2xl font-bold text-cyan-400">
                        Rp{" "}
                        {Number(
                          product.price || 0
                        ).toLocaleString()}
                      </h3>
                    </div>

                    <div>
                      <p className="text-gray-400 text-sm">
                        Stock
                      </p>

                      <h3 className="text-2xl font-bold">
                        {product.stock}
                      </h3>
                    </div>

                  </div>

                  <div className="flex gap-3">

                    <Link
                      href={`/seller/products/edit/${product.id}`}
                      className="flex-1 bg-cyan-500 text-black text-center py-3 rounded-xl font-bold"
                    >
                      Edit
                    </Link>

                    <button
                      onClick={() =>
                        toggleStatus(product)
                      }
                      className="flex-1 bg-yellow-500 text-black py-3 rounded-xl font-bold"
                    >
                      {product.status === "active"
                        ? "Deactivate"
                        : "Activate"}
                    </button>

                    <button
                      onClick={() =>
                        deleteProduct(product.id)
                      }
                      className="bg-red-500 px-5 rounded-xl font-bold"
                    >
                      Delete
                    </button>

                  </div>

                </div>

              </div>

            ))}

          </div>

        )}

      </div>
    </div>
  );
}