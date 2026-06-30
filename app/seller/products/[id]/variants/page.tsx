"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { authenticatedFetchJson } from "@/lib/authenticatedFetch";

 type ProductSummary = {
  id: number;
  title: string;
  has_variants?: boolean | null;
};

type Variant = {
  id: number;
  product_id: number;
  sku: string;
  name: string;
  attributes: Record<string, unknown> | null;
  price: string | number;
  stock: number;
  status: string;
  sort_order: number;
};

type FormState = {
  name: string;
  sku: string;
  price: string;
  stock: string;
  status: "active" | "inactive";
  attributeLabel: string;
  attributeValue: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  sku: "",
  price: "",
  stock: "1",
  status: "active",
  attributeLabel: "Option",
  attributeValue: "",
};

function formatPrice(value: string | number) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

export default function ProductVariantsPage() {
  const params = useParams<{ id?: string }>();
  const productId = Number(Array.isArray(params?.id) ? params.id[0] : params?.id);
  const [product, setProduct] = useState<ProductSummary | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!Number.isInteger(productId) || productId <= 0) return;
    try {
      setLoading(true);
      const data = await authenticatedFetchJson<{
        product: ProductSummary;
        variants: Variant[];
      }>(`/api/seller/variants?productId=${productId}`);
      setProduct(data.product);
      setVariants(data.variants || []);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load variants.");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const totals = useMemo(
    () => ({
      count: variants.length,
      stock: variants.reduce((sum, item) => sum + Number(item.stock || 0), 0),
      min: variants.length ? Math.min(...variants.map((item) => Number(item.price || 0))) : 0,
      max: variants.length ? Math.max(...variants.map((item) => Number(item.price || 0))) : 0,
    }),
    [variants]
  );

  function editVariant(variant: Variant) {
    const entries = Object.entries(variant.attributes || {});
    setEditingId(variant.id);
    setForm({
      name: variant.name,
      sku: variant.sku,
      price: String(variant.price),
      stock: String(variant.stock),
      status: variant.status === "inactive" ? "inactive" : "active",
      attributeLabel: entries[0]?.[0] || "Option",
      attributeValue: String(entries[0]?.[1] || variant.name),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      productId,
      variantId: editingId,
      name: form.name,
      sku: form.sku,
      price: Number(form.price),
      stock: Number(form.stock),
      status: form.status,
      attributes: form.attributeValue.trim()
        ? { [form.attributeLabel.trim() || "Option"]: form.attributeValue.trim() }
        : {},
    };

    try {
      await authenticatedFetchJson("/api/seller/variants", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      resetForm();
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save variant.");
    } finally {
      setSaving(false);
    }
  }

  async function removeVariant(variant: Variant) {
    if (!confirm(`Remove SKU ${variant.sku}?`)) return;
    try {
      await authenticatedFetchJson("/api/seller/variants", {
        method: "DELETE",
        body: JSON.stringify({ variantId: variant.id }),
      });
      if (editingId === variant.id) resetForm();
      await load();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Failed to remove variant.");
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-[#020617] p-10 text-white">Loading variants...</main>;
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,.22),transparent_35%)] px-6 py-10 md:px-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 lg:flex-row lg:items-start">
          <div>
            <p className="inline-flex rounded-full border border-violet-400/30 bg-violet-400/10 px-4 py-2 text-sm font-black text-violet-300">
              Catalog Variants V13
            </p>
            <h1 className="mt-4 text-4xl font-black md:text-6xl">SKU Variants</h1>
            <p className="mt-3 text-slate-300">{product?.title || "Product"}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/seller/inventory" className="rounded-xl border border-violet-400/40 px-5 py-3 font-black text-violet-300">
              Bulk Inventory
            </Link>
            <Link href="/seller/products" className="rounded-xl border border-white/10 px-5 py-3 font-black text-slate-300">
              Back to Products
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[380px_1fr] md:px-10">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-bold text-slate-400">SKUs</p>
              <p className="mt-2 text-3xl font-black text-violet-300">{totals.count}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-bold text-slate-400">Total Stock</p>
              <p className="mt-2 text-3xl font-black text-cyan-300">{totals.stock}</p>
            </div>
            <div className="col-span-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-bold text-slate-400">Price Range</p>
              <p className="mt-2 text-xl font-black">{formatPrice(totals.min)} – {formatPrice(totals.max)}</p>
            </div>
          </div>

          <form onSubmit={submit} className="rounded-3xl border border-violet-400/20 bg-violet-400/[0.06] p-6">
            <h2 className="text-2xl font-black">{editingId ? "Edit Variant" : "Add Variant"}</h2>
            <div className="mt-5 space-y-4">
              <input value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} placeholder="Variant name, e.g. 1,000 Coins" className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 outline-none focus:border-violet-400" required />
              <input value={form.sku} onChange={(e) => setForm((v) => ({ ...v, sku: e.target.value.toUpperCase() }))} placeholder="SKU, e.g. MLBB-1000" className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 outline-none focus:border-violet-400" required />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" min="1" value={form.price} onChange={(e) => setForm((v) => ({ ...v, price: e.target.value }))} placeholder="Price" className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 outline-none focus:border-violet-400" required />
                <input type="number" min="0" value={form.stock} onChange={(e) => setForm((v) => ({ ...v, stock: e.target.value }))} placeholder="Stock" className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 outline-none focus:border-violet-400" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input value={form.attributeLabel} onChange={(e) => setForm((v) => ({ ...v, attributeLabel: e.target.value }))} placeholder="Attribute, e.g. Amount" className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 outline-none focus:border-violet-400" />
                <input value={form.attributeValue} onChange={(e) => setForm((v) => ({ ...v, attributeValue: e.target.value }))} placeholder="Value, e.g. 1,000" className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 outline-none focus:border-violet-400" />
              </div>
              <select value={form.status} onChange={(e) => setForm((v) => ({ ...v, status: e.target.value as FormState["status"] }))} className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 outline-none focus:border-violet-400">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              {error ? <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p> : null}
              <div className="flex gap-3">
                <button disabled={saving} className="flex-1 rounded-xl bg-violet-400 px-4 py-3 font-black text-black disabled:opacity-60">
                  {saving ? "Saving..." : editingId ? "Update Variant" : "Add Variant"}
                </button>
                {editingId ? <button type="button" onClick={resetForm} className="rounded-xl border border-white/10 px-4 py-3 font-black">Cancel</button> : null}
              </div>
            </div>
          </form>
        </div>

        <div className="space-y-4">
          {variants.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/20 p-12 text-center">
              <h2 className="text-2xl font-black">No variants yet</h2>
              <p className="mt-2 text-slate-400">Add packages, regions, platforms, ranks, or denominations as separate SKUs.</p>
            </div>
          ) : variants.map((variant) => (
            <article key={variant.id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-black">{variant.name}</h2>
                    <span className="rounded-full bg-violet-400/10 px-3 py-1 text-xs font-black text-violet-300">{variant.sku}</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${variant.status === "active" ? "bg-emerald-400/10 text-emerald-300" : "bg-yellow-400/10 text-yellow-300"}`}>{variant.status}</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-400">
                    {Object.entries(variant.attributes || {}).map(([key, value]) => `${key}: ${String(value)}`).join(" · ") || "No attributes"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="text-right"><p className="text-xs text-slate-400">Price</p><p className="font-black text-cyan-300">{formatPrice(variant.price)}</p></div>
                  <div className="text-right"><p className="text-xs text-slate-400">Stock</p><p className="font-black">{variant.stock}</p></div>
                  <button onClick={() => editVariant(variant)} className="rounded-xl bg-cyan-400 px-4 py-2 font-black text-black">Edit</button>
                  <button onClick={() => void removeVariant(variant)} className="rounded-xl border border-red-400/40 px-4 py-2 font-black text-red-300">Remove</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
