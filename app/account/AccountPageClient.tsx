"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import { supabase } from "@/lib/supabase";

type AccountSettings = {
  first_name: string;
  last_name: string;
  national_identity_number: string;
  gender: "male" | "female" | "rather_not_say" | "";
  date_of_birth: string;
  instant_messenger_type: string;
  instant_messenger_value: string;
  phone_number: string;
};

type BillingProfile = {
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  postal_code: string;
  country_code: string;
  tax_country_code: string;
  tax_identification_number: string;
};

const emptyAccount: AccountSettings = {
  first_name: "",
  last_name: "",
  national_identity_number: "",
  gender: "",
  date_of_birth: "",
  instant_messenger_type: "",
  instant_messenger_value: "",
  phone_number: "",
};

const emptyBilling: BillingProfile = {
  address_line_1: "",
  address_line_2: "",
  city: "",
  state: "",
  postal_code: "",
  country_code: "ID",
  tax_country_code: "ID",
  tax_identification_number: "",
};

export default function AccountPageClient() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [account, setAccount] = useState<AccountSettings>(emptyAccount);
  const [billing, setBilling] = useState<BillingProfile>(emptyBilling);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadAccount = async () => {
      const { data: authData } = await supabase.auth.getUser();

      if (!authData.user) {
        router.push("/");
        return;
      }

      const currentUserId = authData.user.id;
      setUserId(currentUserId);

      const [{ data: accountData }, { data: billingData }] = await Promise.all([
        supabase.from("user_account_settings").select("*").eq("user_id", currentUserId).maybeSingle(),
        supabase.from("user_billing_profiles").select("*").eq("user_id", currentUserId).maybeSingle(),
      ]);

      if (accountData) {
        setAccount({
          first_name: accountData.first_name || "",
          last_name: accountData.last_name || "",
          national_identity_number: accountData.national_identity_number || "",
          gender: accountData.gender || "",
          date_of_birth: accountData.date_of_birth || "",
          instant_messenger_type: accountData.instant_messenger_type || "",
          instant_messenger_value: accountData.instant_messenger_value || "",
          phone_number: accountData.phone_number || "",
        });
      }

      if (billingData) {
        setBilling({
          address_line_1: billingData.address_line_1 || "",
          address_line_2: billingData.address_line_2 || "",
          city: billingData.city || "",
          state: billingData.state || "",
          postal_code: billingData.postal_code || "",
          country_code: billingData.country_code || "ID",
          tax_country_code: billingData.tax_country_code || "ID",
          tax_identification_number: billingData.tax_identification_number || "",
        });
      }

      setLoading(false);
    };

    void loadAccount();
  }, [router]);

  const updateAccount = (field: keyof AccountSettings, value: string) => {
    setAccount((current) => ({ ...current, [field]: value }));
  };

  const updateBilling = (field: keyof BillingProfile, value: string) => {
    setBilling((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!userId) return;

    setSaving(true);

    const accountPayload = {
      user_id: userId,
      ...account,
      gender: account.gender || null,
      date_of_birth: account.date_of_birth || null,
      updated_at: new Date().toISOString(),
    };

    const billingPayload = {
      user_id: userId,
      ...billing,
      updated_at: new Date().toISOString(),
    };

    const [accountResult, billingResult] = await Promise.all([
      supabase.from("user_account_settings").upsert(accountPayload, { onConflict: "user_id" }),
      supabase.from("user_billing_profiles").upsert(billingPayload, { onConflict: "user_id" }),
    ]);

    setSaving(false);

    if (accountResult.error || billingResult.error) {
      alert(accountResult.error?.message || billingResult.error?.message || "Failed to save account.");
      return;
    }

    alert("Account saved successfully.");
  };

  if (loading) {
    return (
      <AccountShell>
        <div className="p-8 text-slate-300">Loading account...</div>
      </AccountShell>
    );
  }

  return (
    <AccountShell>
      <form onSubmit={handleSave}>
        <section className="border-b border-white/10 p-6 md:p-8">
          <h1 className="text-2xl font-black">Personal</h1>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Field label="First Name" value={account.first_name} onChange={(value) => updateAccount("first_name", value)} />
            <Field label="Last Name" value={account.last_name} onChange={(value) => updateAccount("last_name", value)} />
            <Field
              label="National identity number"
              value={account.national_identity_number}
              onChange={(value) => updateAccount("national_identity_number", value)}
            />
            <Field label="Mobile number" value={account.phone_number} onChange={(value) => updateAccount("phone_number", value)} />
          </div>

          <div className="mt-6">
            <p className="mb-3 text-sm text-slate-300">Gender</p>
            <div className="flex flex-wrap gap-3">
              {[
                ["male", "Male"],
                ["female", "Female"],
                ["rather_not_say", "Rather not say"],
              ].map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="radio"
                    name="gender"
                    checked={account.gender === value}
                    onChange={() => updateAccount("gender", value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="mt-6 max-w-sm">
            <Field
              type="date"
              label="Date of birth"
              value={account.date_of_birth}
              onChange={(value) => updateAccount("date_of_birth", value)}
            />
          </div>
        </section>

        <section className="border-b border-white/10 p-6 md:p-8">
          <h2 className="text-2xl font-black">Instant messenger</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Instant messenger</span>
              <select
                value={account.instant_messenger_type}
                onChange={(event) => updateAccount("instant_messenger_type", event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none focus:border-cyan-400"
              >
                <option value="">Please select</option>
                <option value="discord">Discord</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="telegram">Telegram</option>
                <option value="line">LINE</option>
              </select>
            </label>
            <Field
              label="Messenger ID / Number"
              value={account.instant_messenger_value}
              onChange={(value) => updateAccount("instant_messenger_value", value)}
            />
          </div>
        </section>

        <section className="border-b border-white/10 p-6 md:p-8">
          <h2 className="text-2xl font-black">Billing address</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Field label="Address" value={billing.address_line_1} onChange={(value) => updateBilling("address_line_1", value)} />
            <Field label="Address line 2" value={billing.address_line_2} onChange={(value) => updateBilling("address_line_2", value)} />
            <Field label="City" value={billing.city} onChange={(value) => updateBilling("city", value)} />
            <Field label="State" value={billing.state} onChange={(value) => updateBilling("state", value)} />
            <Field label="ZIP code" value={billing.postal_code} onChange={(value) => updateBilling("postal_code", value)} />
            <Field label="Country / Region" value={billing.country_code} onChange={(value) => updateBilling("country_code", value)} />
          </div>
        </section>

        <section className="p-6 md:p-8">
          <h2 className="text-2xl font-black">Tax</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Field label="Tax country" value={billing.tax_country_code} onChange={(value) => updateBilling("tax_country_code", value)} />
            <Field
              label="Tax identification number"
              value={billing.tax_identification_number}
              onChange={(value) => updateBilling("tax_identification_number", value)}
            />
          </div>
          <div className="mt-8 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-cyan-400 px-8 py-3 font-black text-black transition hover:bg-cyan-300 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </section>
      </form>
    </AccountShell>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-slate-300">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none focus:border-cyan-400"
      />
    </label>
  );
}
