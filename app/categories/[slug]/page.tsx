import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data: category } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .single();

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("category", category?.name || "");

  return (
    <main className="min-h-screen bg-gray-950 p-8 text-white">
      <Link href="/" className="text-cyan-400">
        ← Back to Home
      </Link>

      <h1 className="mt-8 text-5xl font-black">
        {category?.icon} {category?.name}
      </h1>

      <p className="mt-2 text-gray-400">
        Browse all offers for {category?.name}
      </p>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {products?.map((product) => (
          <div
            key={product.id}
            className="rounded-3xl border border-gray-800 bg-gray-900 p-6"
          >
            <h2 className="text-2xl font-bold">{product.title}</h2>

            <p className="mt-3 text-gray-400">{product.description}</p>

            <p className="mt-6 text-2xl font-black text-cyan-400">
              Rp {product.price}
            </p>

            <p className="mt-2 text-sm text-gray-500">
              Seller: {product.seller}
            </p>

            <Link
              href={`/product/${product.id}`}
              className="mt-6 block rounded-2xl bg-cyan-400 py-3 text-center font-bold text-black"
            >
              Buy Now
            </Link>
          </div>
        ))}
      </div>
    </main>
  );
}