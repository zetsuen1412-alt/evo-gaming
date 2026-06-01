"use client";

import "react-phone-number-input/style.css";

import { useEffect, useState } from "react";
import Link from "next/link";
import PhoneInput from "react-phone-number-input";
import type { E164Number } from "libphonenumber-js/core";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  email: string | null;
  username: string | null;
  role: string | null;
  seller_status: string | null;
  seller_name: string | null;
  bio: string | null;
  discord: string | null;
  avatar_url: string | null;
  created_at: string;
};

type SellerApplication = {
  id: number;
  user_id: string;
  email: string;
  seller_name: string;
  full_name: string;
  phone: string;
  discord: string | null;
  identity_number: string;
  identity_image: string | null;
  status: string | null;
  notes: string | null;
  created_at: string;
};

export default function SellerApplicationPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [existingApplication, setExistingApplication] =
    useState<SellerApplication | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [sellerName, setSellerName] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState<E164Number | undefined>();
  const [discord, setDiscord] = useState("");
  const [identityNumber, setIdentityNumber] = useState("");
  const [identityImage, setIdentityImage] = useState("");

  async function getOrCreateProfile(currentUser: User) {
    const { data: profileById, error: profileByIdError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (profileByIdError) {
      throw new Error(profileByIdError.message);
    }

    if (profileById) {
      return profileById as Profile;
    }

    if (currentUser.email) {
      const { data: profileByEmail, error: profileByEmailError } =
        await supabase
          .from("profiles")
          .select("*")
          .eq("email", currentUser.email)
          .maybeSingle();

      if (profileByEmailError) {
        throw new Error(profileByEmailError.message);
      }

      if (profileByEmail) {
        return profileByEmail as Profile;
      }
    }

    const fallbackUsername =
      currentUser.user_metadata?.username ||
      currentUser.email?.split("@")[0] ||
      "ComePlayers User";

    const { data: createdProfile, error: createProfileError } = await supabase
      .from("profiles")
      .insert({
        id: currentUser.id,
        email: currentUser.email || "",
        username: fallbackUsername,
        role: "user",
        seller_status: "not_applied",
        seller_name: null,
        avatar_url: null,
        bio: "ComePlayers user.",
        discord: null,
      })
      .select("*")
      .single();

    if (createProfileError) {
      throw new Error(createProfileError.message);
    }

    return createdProfile as Profile;
  }

  useEffect(() => {
    async function initializePage() {
      try {
        setLoading(true);

        const { data: userData, error: userError } =
          await supabase.auth.getUser();

        if (userError) {
          alert(userError.message);
          setLoading(false);
          return;
        }

        if (!userData.user) {
          setUser(null);
          setLoading(false);
          return;
        }

        setUser(userData.user);

        const profileData = await getOrCreateProfile(userData.user);
        setProfile(profileData);

        if (profileData.seller_name) {
          setSellerName(profileData.seller_name);
        } else if (profileData.username) {
          setSellerName(profileData.username);
        }

        if (profileData.discord) {
          setDiscord(profileData.discord);
        }

        const { data: applicationData, error: applicationError } =
          await supabase
            .from("seller_applications")
            .select("*")
            .eq("user_id", userData.user.id)
            .order("id", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (applicationError) {
          alert(applicationError.message);
          setLoading(false);
          return;
        }

        setExistingApplication(applicationData);
        setLoading(false);
      } catch (error) {
        console.error("Initialize seller application error:", error);
        alert(
          error instanceof Error
            ? error.message
            : "Failed to initialize seller application."
        );
        setLoading(false);
      }
    }

    initializePage();
  }, []);

  async function submitSellerApplication(event: React.FormEvent) {
    event.preventDefault();

    try {
      if (!user) {
        alert("User not found. Please login again.");
        return;
      }

      if (!profile) {
        alert("Profile not found. Please refresh this page.");
        return;
      }

      if (!sellerName.trim()) {
        alert("Seller name is required.");
        return;
      }

      if (!fullName.trim()) {
        alert("Full legal name is required.");
        return;
      }

      if (!phone) {
        alert("Phone number is required.");
        return;
      }

      if (!identityNumber.trim()) {
        alert("Identity number is required.");
        return;
      }

      if (profile.seller_status === "approved") {
        alert("Your seller account is already approved.");
        return;
      }

      if (profile.seller_status === "pending") {
        alert("Your seller application is already under review.");
        return;
      }

      setSubmitting(true);

      const { error: applicationError } = await supabase
        .from("seller_applications")
        .insert({
          user_id: user.id,
          email: user.email || profile.email || "",
          seller_name: sellerName.trim(),
          full_name: fullName.trim(),
          phone: String(phone),
          discord: discord.trim() || null,
          identity_number: identityNumber.trim(),
          identity_image: identityImage.trim() || null,
          status: "pending",
          notes: null,
        });

      if (applicationError) {
        alert(`Database Error: ${applicationError.message}`);
        setSubmitting(false);
        return;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          seller_status: "pending",
          seller_name: sellerName.trim(),
          discord: discord.trim() || null,
          bio: "Seller application submitted. Waiting for approval.",
        })
        .eq("id", user.id);

      if (profileError) {
        alert(`Profile Update Error: ${profileError.message}`);
        setSubmitting(false);
        return;
      }

      alert("Seller application submitted successfully.");
      window.location.reload();
    } catch (error) {
      console.error("Submit seller application error:", error);
      alert("Unexpected error occurred. Please check browser console.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <p className="text-xl font-black text-cyan-300">
          Loading seller application...
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
        <div className="max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <h1 className="text-3xl font-black text-cyan-300">Login Required</h1>
          <p className="mt-4 text-gray-400">
            Please login first to apply as a seller.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-full bg-cyan-400 px-6 py-3 font-black text-black hover:bg-cyan-300"
          >
            Back to Home
          </Link>
        </div>
      </main>
    );
  }

  const sellerStatus = profile?.seller_status || "not_applied";

  if (sellerStatus === "approved") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
        <div className="max-w-md rounded-3xl border border-green-400/20 bg-green-400/10 p-8 text-center">
          <h1 className="text-3xl font-black text-green-300">
            Seller Approved
          </h1>
          <p className="mt-4 text-gray-300">
            Your seller account has already been approved.
          </p>
          <Link
            href="/seller"
            className="mt-6 inline-block rounded-full bg-cyan-400 px-6 py-3 font-black text-black hover:bg-cyan-300"
          >
            Open Seller Dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (sellerStatus === "pending" || existingApplication?.status === "pending") {
    return (
      <main className="min-h-screen bg-[#020617] text-white">
        <nav className="flex h-20 items-center justify-between border-b border-white/10 bg-[#020617]/90 px-8">
          <Link href="/" className="flex items-center">
            <img
              src="/logo.png?v=2"
              alt="ComePlayers"
              className="h-16 w-auto object-contain md:h-20"
            />
          </Link>

          <Link
            href="/"
            className="rounded-full border border-cyan-400 px-5 py-2 font-bold text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
          >
            Back to Home
          </Link>
        </nav>

        <section className="flex min-h-[calc(100vh-80px)] items-center justify-center px-6 py-12">
          <div className="max-w-xl rounded-3xl border border-yellow-400/20 bg-yellow-400/10 p-8 text-center shadow-2xl shadow-black/40">
            <h1 className="text-4xl font-black text-yellow-300">
              Application Under Review
            </h1>

            <p className="mt-4 text-gray-300">
              Your seller application is being reviewed by ComePlayers. You will
              be able to access the Seller Dashboard after approval.
            </p>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5 text-left">
              <p className="text-sm text-gray-400">Seller Name</p>
              <p className="mt-1 font-black">
                {existingApplication?.seller_name || profile?.seller_name || "-"}
              </p>

              <p className="mt-4 text-sm text-gray-400">Status</p>
              <p className="mt-1 font-black text-yellow-300">Pending Review</p>
            </div>

            <Link
              href="/"
              className="mt-6 inline-block rounded-full bg-cyan-400 px-6 py-3 font-black text-black hover:bg-cyan-300"
            >
              Back to Home
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <style jsx global>{`
        .PhoneInput {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          border-radius: 1rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: #000;
          padding: 0 20px;
          color: white;
        }

        .PhoneInput:focus-within {
          border-color: rgb(34, 211, 238);
        }

        .PhoneInputCountry {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-right: 12px;
          border-right: 1px solid rgba(255, 255, 255, 0.1);
        }

        .PhoneInputCountrySelect {
          cursor: pointer;
          background: #000;
          color: white;
        }

        .PhoneInputCountryIcon {
          width: 28px;
          height: 20px;
          border-radius: 3px;
          overflow: hidden;
        }

        .PhoneInputInput {
          flex: 1;
          min-width: 0;
          border: none;
          outline: none;
          background: transparent;
          padding: 16px 0;
          color: white;
          font-size: 16px;
        }

        .PhoneInputInput::placeholder {
          color: rgb(107, 114, 128);
        }
      `}</style>

      <nav className="sticky top-0 z-50 flex h-20 items-center justify-between border-b border-white/10 bg-[#020617]/90 px-8 backdrop-blur-xl">
        <Link href="/" className="flex items-center">
          <img
            src="/logo.png?v=2"
            alt="ComePlayers"
            className="h-16 w-auto object-contain md:h-20"
          />
        </Link>

        <Link
          href="/"
          className="rounded-full border border-cyan-400 px-5 py-2 font-bold text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
        >
          Back to Home
        </Link>
      </nav>

      <section className="relative overflow-hidden border-b border-white/10 px-8 py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(37,99,235,.18),transparent_34%)]" />

        <div className="relative z-10">
          <p className="mb-4 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
            Seller Verification
          </p>

          <h1 className="text-5xl font-black md:text-7xl">
            Apply to Become a Seller
          </h1>

          <p className="mt-5 max-w-2xl text-gray-300">
            Complete your seller application so our team can verify your
            identity and unlock the Seller Dashboard.
          </p>
        </div>
      </section>

      <section className="grid gap-8 px-8 py-10 lg:grid-cols-[1fr_420px]">
        <form
          onSubmit={submitSellerApplication}
          className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/30"
        >
          <h2 className="text-3xl font-black">Seller Information</h2>

          <div className="mt-7 grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-gray-300">
                Seller Name
              </label>

              <input
                value={sellerName}
                onChange={(event) => setSellerName(event.target.value)}
                placeholder="Example: EvoGaming Store"
                className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-300">
                Full Legal Name
              </label>

              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Your legal full name"
                className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-gray-300">
                Phone Number
              </label>

              <PhoneInput
                international
                defaultCountry="ID"
                value={phone}
                onChange={setPhone}
                placeholder="Enter phone number"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-300">
                Discord Username
              </label>

              <input
                value={discord}
                onChange={(event) => setDiscord(event.target.value)}
                placeholder="username#0000"
                className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-gray-300">
                Identity Number
              </label>

              <input
                value={identityNumber}
                onChange={(event) => setIdentityNumber(event.target.value)}
                placeholder="ID / Passport number"
                className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-300">
                Identity Image URL
              </label>

              <input
                value={identityImage}
                onChange={(event) => setIdentityImage(event.target.value)}
                placeholder="https://example.com/identity-image.jpg"
                className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div className="mt-7 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-5">
            <h3 className="font-black text-yellow-300">Important Notice</h3>

            <p className="mt-3 text-sm text-gray-300">
              Seller approval is not instant. ComePlayers will review your
              identity and marketplace readiness before unlocking seller
              features.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-8 w-full rounded-2xl bg-cyan-400 py-4 text-lg font-black text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Submitting Application..." : "Submit Application"}
          </button>
        </form>

        <aside className="h-fit rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/30">
          <h2 className="text-3xl font-black">Verification Steps</h2>

          <div className="mt-7 grid gap-5">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <p className="text-sm font-black text-cyan-300">Step 1</p>
              <h3 className="mt-2 font-black">Submit Application</h3>
              <p className="mt-2 text-sm text-gray-400">
                Provide your seller identity and contact information.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <p className="text-sm font-black text-cyan-300">Step 2</p>
              <h3 className="mt-2 font-black">Manual Review</h3>
              <p className="mt-2 text-sm text-gray-400">
                ComePlayers reviews your seller application.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <p className="text-sm font-black text-cyan-300">Step 3</p>
              <h3 className="mt-2 font-black">Seller Approval</h3>
              <p className="mt-2 text-sm text-gray-400">
                Once approved, your Seller Dashboard will be unlocked.
              </p>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}