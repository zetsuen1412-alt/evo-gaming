"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import { supabase } from "@/lib/supabase";

type SecuritySettings = {
  email: string;
  phone_number: string;
  mfa_enabled: boolean;
  show_followers: boolean;
  accept_profile_chat: boolean;
};

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  return `${name.slice(0, 2)}*****@${domain}`;
}

function maskPhone(phone: string) {
  if (!phone) return "Not set";
  return `${phone.slice(0, 4)}*****${phone.slice(-2)}`;
}

export default function SecurityPageClient() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [settings, setSettings] = useState<SecuritySettings>({
    email: "",
    phone_number: "",
    mfa_enabled: false,
    show_followers: true,
    accept_profile_chat: true,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSecurity = async () => {
      const { data: authData } = await supabase.auth.getUser();

      if (!authData.user) {
        router.push("/");
        return;
      }

      setUserId(authData.user.id);

      const { data } = await supabase
        .from("user_account_settings")
        .select("phone_number,mfa_enabled,show_followers,accept_profile_chat")
        .eq("user_id", authData.user.id)
        .maybeSingle();

      setSettings({
        email: authData.user.email || "",
        phone_number: data?.phone_number || "",
        mfa_enabled: Boolean(data?.mfa_enabled),
        show_followers: data?.show_followers ?? true,
        accept_profile_chat: data?.accept_profile_chat ?? true,
      });

      setLoading(false);
    };

    void loadSecurity();
  }, [router]);

  const updateToggle = async (field: "mfa_enabled" | "show_followers" | "accept_profile_chat") => {
    if (!userId) return;

    const nextValue = !settings[field];

    setSettings((current) => ({ ...current, [field]: nextValue }));

    const { error } = await supabase.from("user_account_settings").upsert(
      {
        user_id: userId,
        [field]: nextValue,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error) {
      setSettings((current) => ({ ...current, [field]: !nextValue }));
      alert(error.message);
    }
  };

  if (loading) {
    return (
      <AccountShell>
        <div className="p-8 text-slate-300">Loading security...</div>
      </AccountShell>
    );
  }

  return (
    <AccountShell>
      <section className="border-b border-white/10 p-6 md:p-8">
        <h1 className="text-2xl font-black">Security</h1>

        <SecurityRow title="Email" description={`Your email address is ${maskEmail(settings.email)}.`} button="Edit" />
        <SecurityRow
          title="Password"
          description="Safeguard your password and do not disclose it to anyone."
          button="Edit"
        />
        <SecurityRow
          title="Mobile number"
          description={`Your current mobile phone number is ${maskPhone(settings.phone_number)}.`}
          button="Edit"
        />

        <ToggleRow
          title="Multi-factor Authentication"
          description="Protect your account with an extra layer of security."
          checked={settings.mfa_enabled}
          onClick={() => updateToggle("mfa_enabled")}
        />
      </section>

      <section className="p-6 md:p-8">
        <h2 className="text-2xl font-black">Privacy</h2>
        <ToggleRow
          title="Show followers and following list"
          description="When toggle off, other users will not be able to view your followers and following list."
          checked={settings.show_followers}
          onClick={() => updateToggle("show_followers")}
        />
        <ToggleRow
          title="Accept chat from profile page"
          description="When toggle off, other users will not be able to chat with you via your profile page."
          checked={settings.accept_profile_chat}
          onClick={() => updateToggle("accept_profile_chat")}
        />
      </section>
    </AccountShell>
  );
}

function SecurityRow({ title, description, button }: { title: string; description: string; button: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/10 py-6">
      <div>
        <h3 className="font-bold">{title}</h3>
        <p className="mt-2 text-sm text-slate-300">{description}</p>
      </div>
      <button type="button" className="rounded-xl border border-white/15 px-5 py-2 text-sm hover:border-cyan-400 hover:text-cyan-300">
        {button}
      </button>
    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onClick,
}: {
  title: string;
  description: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/10 py-6">
      <div>
        <h3 className="font-bold">{title}</h3>
        <p className="mt-2 text-sm text-slate-300">{description}</p>
      </div>
      <button
        type="button"
        onClick={onClick}
        className={`h-7 w-14 rounded-full p-1 transition ${checked ? "bg-cyan-400" : "bg-slate-600"}`}
      >
        <span className={`block h-5 w-5 rounded-full bg-white transition ${checked ? "translate-x-7" : ""}`} />
      </button>
    </div>
  );
}
