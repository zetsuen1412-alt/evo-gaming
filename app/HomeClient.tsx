"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Category = {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
};

export default function HomeClient() {
  const searchParams = useSearchParams();

  const [categories, setCategories] = useState<Category[]>([]);

  const search = searchParams.get("q") || "";

  useEffect(() => {
    async function initializePage() {
      const { data: categoryData } = await supabase
        .from("categories")
        .select("*")
        .order("id", { ascending: true });

      setCategories(categoryData || []);
    }

    initializePage();
  }, []);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories;

    return categories.filter((category) =>
      category.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [categories, search]);

  return (
    <main
      className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat text-white"
      style={{
        backgroundImage:
          "linear-gradient(rgba(2,6,23,.72), rgba(2,6,23,.9)), url('/hero-bg.webp')",
      }}
    >
      {/* PASTE SELURUH JSX YANG ADA DI FILE LAMA MULAI DARI <section> SAMPAI PENUTUP </main> */}
    </main>
  );
}