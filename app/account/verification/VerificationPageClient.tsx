"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import { supabase } from "@/lib/supabase";

type VerificationState = {
  phone_verified: boolean;
  email_verified: boolean;
  identity_verified: boolean;
  phone_number: string;
};

function maskPhone(phone: string) {
  if (!phone) return "Not set";
  return `${phone.slice(0, 4)}*****${phone.slice(-2)}`;
}

export default function VerificationPageClient() {
  const router = useRouter();
  const [verification, setVerification] = useState<VerificationState>({
    phone_verified: false,
    email_verified: false,
    identity_verified: false,
    phone_number: "",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadVerification = async () => {
      const { data: authData } = await supabase.auth.getUser();

      if (!authData.user) {
        router.push("/");
        return;
      }

      const { data: accountData } = await supabase
        .from("user_account_settings")
        .select("phone_number")
        .eq("user_id", authData.user.id)
        .maybeSingle();

      const { data: verificationData } = await supabase
        .from("user_verifications")
        .select("phone_verified,email_verified,identity_verified,phone_number")
        .eq("user_id", authData.user.id)
        .maybeSingle();

      setVerification({
        phone_verified: Boolean(verificationData?.phone_verified),
        email_verified: Boolean(authData.user.email_confirmed_at || verificationData?.email_verified),
        identity_verified: Boolean(verificationData?.identity_verified),
        phone_number: verificationData?.phone_number || accountData?.phone_number || "",
      });

      setLoading(false);
    };

    void loadVerification();
  }, [router]);

  if (loading) {
    return (
      <AccountShell>
        <div className="p-8 text-slate-300">Loading verification...</div>
      </AccountShell>
    );
  }

  return (
    <AccountShell>
      <section className="p-6 md:p-8">
        <h1 className="text-2xl font-black">Verification</h1>
        <p className="mt-2 text-sm text-slate-300">Verify your account to help you sell and buy more easily.</p>

        <div className="mt-8 space-y-4">
          <VerificationCard
            title="Email"
            value={verification.email_verified ? "Verified email" : "Email is not verified"}
            verified={verification.email_verified}
          />
          <VerificationCard
            title="Mobile number"
            value={maskPhone(verification.phone_number)}
            verified={verification.phone_verified}
          />
          <VerificationCard
            title="Identity"
            value={verification.identity_verified ? "Identity verified" : "Identity verification not submitted"}
            verified={verification.identity_verified}
          />
        </div>
      </section>
    </AccountShell>
  );
}

function VerificationCard({ title, value, verified }: { title: string; value: string; verified: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-5">
      <div>
        <h3 className="font-bold">{title}</h3>
        <p className="mt-1 text-sm text-slate-300">{value}</p>
      </div>
      <span
        className={`rounded-full px-3 py-1 text-xs font-bold ${
          verified ? "bg-emerald-400/10 text-emerald-300" : "bg-yellow-400/10 text-yellow-300"
        }`}
      >
        {verified ? "Verified" : "Pending"}
      </span>
    </div>
  );
}
