"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type MethodGroup = "wallet" | "bank" | "card" | "international" | "crypto";

type PaymentMethod = {
  id: string;
  name: string;
  group: MethodGroup;
  label: string;
  detail: string;
  fee: string;
  logo: string;
  accent: string;
};

const paymentMethods: PaymentMethod[] = [
  {
    id: "qris",
    name: "QRIS",
    group: "wallet",
    label: "Instant QR Payment",
    detail: "Scan QR code to pay instantly.",
    fee: "+ $1.00 service fee",
    logo: "QR",
    accent: "from-cyan-400 to-blue-500",
  },
  {
    id: "dana",
    name: "DANA",
    group: "wallet",
    label: "E-Wallet",
    detail: "Transfer to DANA account.",
    fee: "+ $0.50 service fee",
    logo: "D",
    accent: "from-blue-400 to-cyan-400",
  },
  {
    id: "ovo",
    name: "OVO",
    group: "wallet",
    label: "E-Wallet",
    detail: "Transfer to OVO account.",
    fee: "+ $0.50 service fee",
    logo: "O",
    accent: "from-purple-500 to-violet-300",
  },
  {
    id: "gopay",
    name: "GoPay",
    group: "wallet",
    label: "E-Wallet",
    detail: "Transfer to GoPay account.",
    fee: "+ $0.50 service fee",
    logo: "G",
    accent: "from-emerald-400 to-cyan-400",
  },
  {
    id: "shopeepay",
    name: "ShopeePay",
    group: "wallet",
    label: "E-Wallet",
    detail: "Transfer to ShopeePay account.",
    fee: "+ $0.50 service fee",
    logo: "S",
    accent: "from-orange-500 to-red-400",
  },
  {
    id: "linkaja",
    name: "LinkAja",
    group: "wallet",
    label: "E-Wallet",
    detail: "Transfer to LinkAja account.",
    fee: "+ $0.50 service fee",
    logo: "LA",
    accent: "from-red-500 to-pink-400",
  },

  {
    id: "bca",
    name: "BCA",
    group: "bank",
    label: "Bank Central Asia",
    detail: "Transfer via BCA bank.",
    fee: "+ $0.75 service fee",
    logo: "BCA",
    accent: "from-blue-500 to-cyan-400",
  },
  {
    id: "mandiri",
    name: "Mandiri",
    group: "bank",
    label: "Bank Mandiri",
    detail: "Transfer via Mandiri bank.",
    fee: "+ $0.75 service fee",
    logo: "M",
    accent: "from-yellow-400 to-blue-500",
  },
  {
    id: "bri",
    name: "BRI",
    group: "bank",
    label: "Bank Rakyat Indonesia",
    detail: "Transfer via BRI bank.",
    fee: "+ $0.75 service fee",
    logo: "BRI",
    accent: "from-blue-600 to-sky-400",
  },
  {
    id: "bni",
    name: "BNI",
    group: "bank",
    label: "Bank Negara Indonesia",
    detail: "Transfer via BNI bank.",
    fee: "+ $0.75 service fee",
    logo: "BNI",
    accent: "from-orange-500 to-teal-400",
  },
  {
    id: "cimb",
    name: "CIMB Niaga",
    group: "bank",
    label: "Bank Transfer",
    detail: "Transfer via CIMB Niaga bank.",
    fee: "+ $0.75 service fee",
    logo: "CIMB",
    accent: "from-red-500 to-red-300",
  },
  {
    id: "permata",
    name: "PermataBank",
    group: "bank",
    label: "Bank Transfer",
    detail: "Transfer via PermataBank.",
    fee: "+ $0.75 service fee",
    logo: "PB",
    accent: "from-red-500 to-green-400",
  },
  {
    id: "danamon",
    name: "Danamon",
    group: "bank",
    label: "Bank Transfer",
    detail: "Transfer via Danamon bank.",
    fee: "+ $0.75 service fee",
    logo: "DN",
    accent: "from-orange-500 to-yellow-300",
  },
  {
    id: "maybank",
    name: "Maybank",
    group: "bank",
    label: "Bank Transfer",
    detail: "Transfer via Maybank Indonesia.",
    fee: "+ $0.75 service fee",
    logo: "MY",
    accent: "from-yellow-400 to-yellow-600",
  },
  {
    id: "bsi",
    name: "BSI",
    group: "bank",
    label: "Bank Syariah Indonesia",
    detail: "Transfer via BSI bank.",
    fee: "+ $0.75 service fee",
    logo: "BSI",
    accent: "from-cyan-400 to-emerald-400",
  },
  {
    id: "panin",
    name: "Panin Bank",
    group: "bank",
    label: "Bank Transfer",
    detail: "Transfer via Panin Bank.",
    fee: "+ $0.75 service fee",
    logo: "PN",
    accent: "from-blue-500 to-blue-300",
  },
  {
    id: "uob",
    name: "UOB",
    group: "bank",
    label: "Bank Transfer",
    detail: "Transfer via UOB bank.",
    fee: "+ $0.75 service fee",
    logo: "UOB",
    accent: "from-red-500 to-red-300",
  },
  {
    id: "ocbc",
    name: "OCBC NISP",
    group: "bank",
    label: "Bank Transfer",
    detail: "Transfer via OCBC NISP.",
    fee: "+ $0.75 service fee",
    logo: "OCBC",
    accent: "from-red-600 to-red-400",
  },

  {
    id: "visa",
    name: "Visa",
    group: "card",
    label: "Credit / Debit Card",
    detail: "Pay securely with Visa card.",
    fee: "+ $1.25 service fee",
    logo: "VISA",
    accent: "from-blue-600 to-cyan-400",
  },
  {
    id: "mastercard",
    name: "Mastercard",
    group: "card",
    label: "Credit / Debit Card",
    detail: "Pay securely with Mastercard.",
    fee: "+ $1.25 service fee",
    logo: "MC",
    accent: "from-red-500 to-orange-400",
  },
  {
    id: "jcb",
    name: "JCB",
    group: "card",
    label: "Credit / Debit Card",
    detail: "Pay securely with JCB card.",
    fee: "+ $1.25 service fee",
    logo: "JCB",
    accent: "from-green-400 to-blue-500",
  },
  {
    id: "amex",
    name: "American Express",
    group: "card",
    label: "Credit / Debit Card",
    detail: "Pay securely with AMEX card.",
    fee: "+ $1.25 service fee",
    logo: "AMEX",
    accent: "from-sky-400 to-blue-700",
  },

  {
    id: "paypal",
    name: "PayPal",
    group: "international",
    label: "Global Payment",
    detail: "Pay using your PayPal account.",
    fee: "+ $1.50 service fee",
    logo: "PP",
    accent: "from-blue-500 to-cyan-300",
  },
  {
    id: "stripe",
    name: "Stripe",
    group: "international",
    label: "Global Payment",
    detail: "International card gateway.",
    fee: "+ $1.50 service fee",
    logo: "ST",
    accent: "from-indigo-500 to-purple-400",
  },
  {
    id: "crypto",
    name: "Crypto",
    group: "crypto",
    label: "Cryptocurrency",
    detail: "Pay with supported cryptocurrency.",
    fee: "+ $2.00 service fee",
    logo: "₿",
    accent: "from-yellow-400 to-orange-500",
  },
];

const tabs: { id: "all" | MethodGroup; name: string; subtitle: string; icon: string }[] = [
  { id: "all", name: "All Methods", subtitle: "All payment options", icon: "▦" },
  { id: "wallet", name: "Digital Wallet", subtitle: "E-wallet and QR", icon: "▱" },
  { id: "bank", name: "Bank Transfer", subtitle: "Indonesian banks", icon: "▤" },
  { id: "card", name: "Cards", subtitle: "Credit / debit cards", icon: "▭" },
  { id: "international", name: "International", subtitle: "Global payment", icon: "◎" },
  { id: "crypto", name: "Crypto", subtitle: "Cryptocurrency", icon: "₿" },
];

export default function PaymentPage() {
  const [activeTab, setActiveTab] = useState<"all" | MethodGroup>("all");
  const [selectedMethodId, setSelectedMethodId] = useState("qris");
  const [promoOpen, setPromoOpen] = useState(false);

  const selectedMethod =
    paymentMethods.find((method) => method.id === selectedMethodId) ||
    paymentMethods[0];

  const visibleMethods = useMemo(() => {
    if (activeTab === "all") return paymentMethods;
    return paymentMethods.filter((method) => method.group === activeTab);
  }, [activeTab]);

  const groupedMethods = useMemo(() => {
    return {
      wallet: visibleMethods.filter((method) => method.group === "wallet"),
      bank: visibleMethods.filter((method) => method.group === "bank"),
      card: visibleMethods.filter((method) => method.group === "card"),
      international: visibleMethods.filter(
        (method) => method.group === "international"
      ),
      crypto: visibleMethods.filter((method) => method.group === "crypto"),
    };
  }, [visibleMethods]);

  const itemPrice = 24.99;
  const platformFee = 1.5;
  const promoDiscount = promoOpen ? 2.5 : 0;
  const total = itemPrice + platformFee - promoDiscount;

  function MethodCard({ method }: { method: PaymentMethod }) {
    const isSelected = selectedMethodId === method.id;

    return (
      <button
        type="button"
        onClick={() => setSelectedMethodId(method.id)}
        className={`group relative rounded-2xl border p-4 text-left transition-all duration-300 ${
          isSelected
            ? "border-cyan-400 bg-cyan-400/10 shadow-lg shadow-cyan-500/20"
            : "border-white/10 bg-white/[0.035] hover:-translate-y-1 hover:border-cyan-400/60 hover:bg-white/[0.065]"
        }`}
      >
        <div className="flex items-start gap-4">
          <span
            className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
              isSelected ? "border-cyan-300" : "border-slate-500"
            }`}
          >
            {isSelected && <span className="h-2 w-2 rounded-full bg-cyan-300" />}
          </span>

          <div className="min-w-0 flex-1">
            <div
              className={`mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${method.accent} text-sm font-black text-white shadow-lg shadow-black/30`}
            >
              {method.logo}
            </div>

            <h3 className="font-black text-white group-hover:text-cyan-300">
              {method.name}
            </h3>

            <p className="mt-1 text-xs text-slate-400">{method.label}</p>
            <p className="mt-2 text-xs text-slate-500">{method.fee}</p>
          </div>
        </div>
      </button>
    );
  }

  function MethodSection({
    title,
    methods,
  }: {
    title: string;
    methods: PaymentMethod[];
  }) {
    if (methods.length === 0) return null;

    return (
      <div className="mt-7">
        <div className="mb-3 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            {title}
          </p>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {methods.map((method) => (
            <MethodCard key={method.id} method={method} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,.16),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(59,130,246,.14),transparent_32%),linear-gradient(180deg,#020617_0%,#050816_55%,#020617_100%)]" />

      <nav className="sticky top-0 z-50 flex h-20 items-center justify-between border-b border-white/10 bg-[#020617]/90 px-8 backdrop-blur-xl">
        <div className="flex items-center gap-5">
          <Link href="/" className="flex items-center">
            <img
              src="/logo.png?v=2"
              alt="ComePlayers"
              className="h-16 w-auto object-contain md:h-20"
            />
          </Link>

          <div className="hidden border-l border-white/10 pl-5 lg:block">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">
              Powered By
            </p>
            <p className="bg-gradient-to-r from-cyan-300 to-blue-500 bg-clip-text text-lg font-black text-transparent">
              EvoGaming
            </p>
          </div>
        </div>

        <Link
          href="/"
          className="rounded-full border border-cyan-400/70 px-5 py-2 font-bold text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
        >
          ← Back to Home
        </Link>
      </nav>

      <section className="mx-auto max-w-7xl px-8 py-8">
        <div className="grid gap-5 border-b border-white/10 pb-8 lg:grid-cols-3">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-cyan-400 bg-cyan-400 text-lg font-black text-black shadow-lg shadow-cyan-500/30">
              1
            </div>
            <div>
              <p className="font-black uppercase">Payment Method</p>
              <p className="text-sm text-slate-400">
                Choose how you want to pay
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 opacity-70">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 text-lg font-black">
              2
            </div>
            <div>
              <p className="font-black uppercase">Review Order</p>
              <p className="text-sm text-slate-400">
                Review your order details
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 opacity-70">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 text-lg font-black">
              3
            </div>
            <div>
              <p className="font-black uppercase">Payment Gateway</p>
              <p className="text-sm text-slate-400">
                Complete your payment
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-8 xl:grid-cols-[1fr_420px]">
          <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/40">
            <div className="mb-7">
              <p className="mb-3 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-cyan-300">
                Secure Checkout
              </p>
              <h1 className="text-4xl font-black">Choose a payment method</h1>
              <p className="mt-2 text-slate-400">
                Select one of the available payment options below.
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-[250px_1fr]">
              <aside className="grid h-fit gap-3">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      activeTab === tab.id
                        ? "border-cyan-400 bg-cyan-400/10 shadow-lg shadow-cyan-500/20"
                        : "border-white/10 bg-white/[0.03] hover:border-cyan-400/60"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-cyan-300">
                        {tab.icon}
                      </div>
                      <div>
                        <p className="font-black">{tab.name}</p>
                        <p className="text-xs text-slate-400">{tab.subtitle}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </aside>

              <div>
                <MethodSection
                  title="Digital Wallet"
                  methods={groupedMethods.wallet}
                />
                <MethodSection
                  title="Indonesian Bank Transfer"
                  methods={groupedMethods.bank}
                />
                <MethodSection
                  title="Card Payment"
                  methods={groupedMethods.card}
                />
                <MethodSection
                  title="International Payment"
                  methods={groupedMethods.international}
                />
                <MethodSection title="Crypto" methods={groupedMethods.crypto} />

                <div className="mt-7 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-slate-300">
                  ℹ You will be able to review your order details before
                  proceeding to payment.
                </div>
              </div>
            </div>
          </section>

          <aside className="h-fit rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/40">
            <h2 className="text-3xl font-black">Order Summary</h2>

            <div className="mt-6 flex gap-4 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-cyan-400/10 text-3xl">
                🎮
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="font-black">JUNED</h3>
                <p className="text-sm text-slate-400">Game Coins</p>
                <p className="text-sm text-slate-500">Seller: ILHAM</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 border-b border-white/10 pb-6">
              <div className="flex justify-between text-slate-300">
                <span>Subtotal</span>
                <span className="font-bold text-white">
                  ${itemPrice.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between text-slate-300">
                <span>Platform Fee</span>
                <span className="font-bold text-white">
                  ${platformFee.toFixed(2)}
                </span>
              </div>

              <button
                onClick={() => setPromoOpen(!promoOpen)}
                className="flex justify-between text-left text-slate-300"
              >
                <span>Promo Code</span>
                <span
                  className={`font-bold ${
                    promoOpen ? "text-emerald-300" : "text-cyan-300"
                  }`}
                >
                  {promoOpen ? "- $2.50" : "Add promo code"}
                </span>
              </button>
            </div>

            <div className="mt-6 flex items-end justify-between">
              <p className="text-lg font-bold">Total Amount</p>
              <p className="text-4xl font-black text-cyan-300">
                ${total.toFixed(2)}
              </p>
            </div>

            <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-5">
              <p className="text-sm text-slate-400">Selected Method</p>
              <div className="mt-3 flex items-center gap-3">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${selectedMethod.accent} font-black`}
                >
                  {selectedMethod.logo}
                </div>
                <div>
                  <p className="font-black">{selectedMethod.name}</p>
                  <p className="text-sm text-slate-400">
                    {selectedMethod.fee}
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() =>
                alert(
                  `Selected payment method: ${selectedMethod.name}. Payment gateway will be connected next.`
                )
              }
              className="mt-7 w-full rounded-2xl bg-cyan-400 py-4 text-lg font-black text-black transition hover:bg-cyan-300"
            >
              Proceed to Payment
            </button>

            <p className="mt-4 text-center text-xs leading-relaxed text-slate-500">
              By placing an order, you agree to ComePlayers Terms of Use and
              Privacy Policy.
            </p>

            <div className="mt-7 grid gap-4 rounded-3xl border border-white/10 bg-black/30 p-5">
              <div className="flex gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
                  🛡️
                </div>
                <div>
                  <p className="font-black">100% Secure</p>
                  <p className="text-sm text-slate-400">
                    Your payment is protected.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
                  ⚡
                </div>
                <div>
                  <p className="font-black">Fast Processing</p>
                  <p className="text-sm text-slate-400">
                    Orders are reviewed quickly.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
                  🎧
                </div>
                <div>
                  <p className="font-black">24/7 Support</p>
                  <p className="text-sm text-slate-400">
                    We are here when you need help.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <footer className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-5 text-sm text-slate-400">
          🔒 Protected by 256-bit SSL encryption. Your data is safe and secure.
        </footer>
      </section>
    </main>
  );
}