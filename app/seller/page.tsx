"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function SellerDashboard() {
  const [loading, setLoading] = useState(true);
  const [seller, setSeller] = useState<any>(null);

  const [stats, setStats] = useState({
    products: 0,
    orders: 0,
    revenue: 0,
    pendingOrders: 0,
  });

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("email", user.email)
        .single();

      if (!profile) {
        alert("Profile not found");
        window.location.href = "/";
        return;
      }

      if (profile.seller_status !== "approved") {
        alert("Seller access required");
        window.location.href = "/";
        return;
      }

      setSeller(profile);

      const { data: products } = await supabase
        .from("products")
        .select("*")
        .eq("seller_id", profile.id);

      const { data: orders } = await supabase
        .from("orders")
        .select("*")
        .eq("seller_id", profile.id);

      const revenue =
        orders?.reduce(
          (sum: number, order: any) =>
            sum + Number(order.total_price || 0),
          0
        ) || 0;

      const pendingOrders =
        orders?.filter(
          (order: any) => order.status === "pending"
        ).length || 0;

      setStats({
        products: products?.length || 0,
        orders: orders?.length || 0,
        revenue,
        pendingOrders,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020b2d] flex items-center justify-center text-cyan-400 text-2xl">
        Loading Seller Dashboard...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020b2d] text-white">
      <div className="max-w-7xl mx-auto px-8 py-10">

        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-5xl font-bold">
              Seller Dashboard
            </h1>

            <p className="text-gray-400 mt-2">
              Welcome back, {seller?.seller_name}
            </p>
          </div>

          <Link
            href="/"
            className="bg-cyan-500 text-black font-bold px-5 py-3 rounded-xl"
          >
            Back Home
          </Link>
        </div>

        <div className="grid md:grid-cols-4 gap-6 mb-10">

          <div className="bg-[#07153f] p-6 rounded-xl">
            <p className="text-gray-400">
              Products
            </p>

            <h2 className="text-4xl font-bold text-cyan-400">
              {stats.products}
            </h2>
          </div>

          <div className="bg-[#07153f] p-6 rounded-xl">
            <p className="text-gray-400">
              Orders
            </p>

            <h2 className="text-4xl font-bold text-cyan-400">
              {stats.orders}
            </h2>
          </div>

          <div className="bg-[#07153f] p-6 rounded-xl">
            <p className="text-gray-400">
              Revenue
            </p>

            <h2 className="text-4xl font-bold text-green-400">
              ${stats.revenue}
            </h2>
          </div>

          <div className="bg-[#07153f] p-6 rounded-xl">
            <p className="text-gray-400">
              Pending Orders
            </p>

            <h2 className="text-4xl font-bold text-yellow-400">
              {stats.pendingOrders}
            </h2>
          </div>

        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">

          <Link
            href="/seller/products/new"
            className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold p-5 rounded-xl text-center"
          >
            Add Product
          </Link>

          <Link
            href="/seller/products"
            className="bg-[#07153f] p-5 rounded-xl text-center"
          >
            Manage Products
          </Link>

          <Link
            href="/seller/orders"
            className="bg-[#07153f] p-5 rounded-xl text-center"
          >
            View Orders
          </Link>

          <Link
            href={`/seller-profile/${seller?.id}`}
            className="bg-[#07153f] p-5 rounded-xl text-center"
          >
            Seller Profile
          </Link>

        </div>

      </div>
    </div>
  );
}