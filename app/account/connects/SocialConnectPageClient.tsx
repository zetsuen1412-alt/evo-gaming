"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import { supabase } from "@/lib/supabase";

type SocialConnection = {
  provider: string;
  is_connected: boolean;
  provider_username: string | null;
};

const providers = [
  { id: "facebook", label: "Facebook", icon: "f" },
  { id: "google", label: "Google", icon: "G" },
  { id: "tiktok", label: "TikTok", icon: "♪" },
  { id: "twitter", label: "Twitter / X", icon: "𝕏" },
  { id: "paypal", label: "PayPal", icon: "P" },
  { id: "instagram", label: "Instagram", icon: "◎" },
  { id: "weibo", label: "Weibo", icon: "W" },
];

export default function SocialConnectPageClient() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadConnections = async () => {
      const { data: authData } = await supabase.auth.getUser();

      if (!authData.user) {
        router.push("/");
        return;
      }

      setUserId(authData.user.id);

      const { data } = await supabase
        .from("user_social_connections")
        .select("provider,is_connected,provider_username")
        .eq("user_id", authData.user.id);

      setConnections(data || []);
      setLoading(false);
    };

    void loadConnections();
  }, [router]);

  const toggleConnection = async (provider: string) => {
    if (!userId) return;

    const current = connections.find((item) => item.provider === provider);
    const nextValue = !current?.is_connected;

    const { error } = await supabase.from("user_social_connections").upsert(
      {
        user_id: userId,
        provider,
        is_connected: nextValue,
        provider_username: nextValue ? "Connected Account" : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" }
    );

    if (error) {
      alert(error.message);
      return;
    }

    setConnections((items) => {
      const exists = items.some((item) => item.provider === provider);
      if (!exists) {
        return [...items, { provider, is_connected: nextValue, provider_username: nextValue ? "Connected Account" : null }];
      }

      return items.map((item) =>
        item.provider === provider
          ? { ...item, is_connected: nextValue, provider_username: nextValue ? "Connected Account" : null }
          : item
      );
    });
  };

  if (loading) {
    return (
      <AccountShell>
        <div className="p-8 text-slate-300">Loading connections...</div>
      </AccountShell>
    );
  }

  return (
    <AccountShell>
      <section className="p-6 md:p-8">
        <h1 className="text-2xl font-black">One-Click Login</h1>
        <p className="mt-2 text-sm text-slate-300">
          Connect your social media or payment account for a fast, secure, and seamless login in the future.
        </p>

        <div className="mt-8 divide-y divide-white/10">
          {providers.map((provider) => {
            const connection = connections.find((item) => item.provider === provider.id);
            const isConnected = Boolean(connection?.is_connected);

            return (
              <div key={provider.id} className="flex items-center justify-between gap-4 py-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan-400 font-black text-black">
                    {provider.icon}
                  </div>
                  <div>
                    <p className="text-sm">
                      Your account is{" "}
                      <span className={isConnected ? "text-emerald-300" : "text-slate-300"}>
                        {isConnected ? "linked" : "not linked"}
                      </span>{" "}
                      to {provider.label}
                    </p>
                    {isConnected && connection?.provider_username ? (
                      <p className="mt-1 text-xs text-slate-400">{connection.provider_username}</p>
                    ) : null}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleConnection(provider.id)}
                  className={`rounded-xl px-4 py-2 text-sm font-bold ${
                    isConnected
                      ? "border border-red-400 text-red-300 hover:bg-red-500/10"
                      : "border border-cyan-400 text-cyan-300 hover:bg-cyan-400 hover:text-black"
                  }`}
                >
                  {isConnected ? "Unlink" : "Link"}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </AccountShell>
  );
}
