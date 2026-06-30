"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import AccountShell from "@/components/account/AccountShell";
import { supabase } from "@/lib/supabase";

type BillingForm = {
  legalName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
  taxCountryCode: string;
  taxIdentificationNumber: string;
};

const emptyForm: BillingForm = {
  legalName: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  countryCode: "ID",
  taxCountryCode: "ID",
  taxIdentificationNumber: "",
};

export default function BillingProfilePage() {
  const [form, setForm] = useState<BillingForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const accessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) throw new Error("Please login again.");
    return data.session.access_token;
  }, []);

  const load = useCallback(async () => {
    try {
      const token = await accessToken();
      const response = await fetch("/api/account/billing", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to load billing profile.");
      const row = json.billing || {};
      setForm({
        legalName: row.legal_name || "",
        addressLine1: row.address_line_1 || "",
        addressLine2: row.address_line_2 || "",
        city: row.city || "",
        state: row.state || "",
        postalCode: row.postal_code || "",
        countryCode: row.country_code || "ID",
        taxCountryCode: row.tax_country_code || "ID",
        taxIdentificationNumber: row.tax_identification_number || "",
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load billing profile.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function update(field: keyof BillingForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const token = await accessToken();
      const response = await fetch("/api/account/billing", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to save billing profile.");
      setMessage("Billing profile saved.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save billing profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AccountShell>
      <section className="border-b border-white/10 p-6 md:p-8">
        <p className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-black text-cyan-300">V22 Billing & Invoice</p>
        <h1 className="mt-4 text-3xl font-black md:text-4xl">Billing & invoice profile</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          This address is snapshotted for purchase invoices. Buyer tax is not added at checkout; the 5% sales tax is withheld from seller proceeds, while withdrawal tax follows the seller payout account country and method.
        </p>
      </section>

      <form onSubmit={save} className="grid gap-5 p-6 md:grid-cols-2 md:p-8">
        <Field label="Legal / billing name" value={form.legalName} onChange={(value) => update("legalName", value)} required className="md:col-span-2" />
        <Field label="Address line 1" value={form.addressLine1} onChange={(value) => update("addressLine1", value)} required className="md:col-span-2" />
        <Field label="Address line 2" value={form.addressLine2} onChange={(value) => update("addressLine2", value)} className="md:col-span-2" />
        <Field label="City" value={form.city} onChange={(value) => update("city", value)} required />
        <Field label="State / province" value={form.state} onChange={(value) => update("state", value)} />
        <Field label="Postal code" value={form.postalCode} onChange={(value) => update("postalCode", value)} required />
        <Field label="Billing country (ISO-2)" value={form.countryCode} onChange={(value) => update("countryCode", value.toUpperCase())} required maxLength={2} />
        <Field label="Tax identification number (optional, invoice record only)" value={form.taxIdentificationNumber} onChange={(value) => update("taxIdentificationNumber", value)} className="md:col-span-2" />

        <div className="md:col-span-2">
          <button disabled={saving || loading} className="rounded-xl bg-cyan-400 px-6 py-3 font-black text-black disabled:opacity-50">
            {saving ? "Saving..." : loading ? "Loading..." : "Save billing profile"}
          </button>
        </div>
      </form>

      {(error || message) && (
        <div className={`mx-6 mb-6 rounded-xl border p-4 text-sm md:mx-8 md:mb-8 ${error ? "border-red-400/30 bg-red-400/10 text-red-200" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"}`}>
          {error || message}
        </div>
      )}
    </AccountShell>
  );
}

function Field({
  label,
  value,
  onChange,
  required = false,
  maxLength,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  maxLength?: number;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-sm font-bold text-slate-300">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        maxLength={maxLength}
        className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
      />
    </label>
  );
}
