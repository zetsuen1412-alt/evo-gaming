import Link from "next/link";

const sections = [
  [
    "Information we process",
    "ComePlayers processes account details, authentication events, orders, messages, wallet and payout records, device and security signals, support activity, and information required for seller verification or legal compliance.",
  ],
  [
    "How information is used",
    "Information is used to provide marketplace features, prevent fraud, protect transactions, calculate fees and tax, process payouts, resolve disputes, support users, and improve service reliability.",
  ],
  [
    "Sharing and providers",
    "Limited data may be shared with infrastructure, authentication, payment, payout, monitoring, and compliance providers when required to deliver the service or satisfy legal obligations.",
  ],
  [
    "Retention and deletion",
    "Account deletion requests are subject to a grace period and mandatory retention for financial, fraud-prevention, dispute, and legal records. Eligible personal fields are scrubbed after the approved deletion workflow completes.",
  ],
  [
    "Your choices",
    "Users can review account settings, update supported profile details, request a privacy export, schedule or cancel eligible deletion requests, and contact support regarding privacy questions.",
  ],
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#050816] px-4 py-12 text-white sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm font-bold text-cyan-300 hover:text-cyan-200">
          ← Back to ComePlayers
        </Link>
        <div className="mt-6 rounded-[28px] border border-white/10 bg-[#11162d] p-6 shadow-2xl sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
            Privacy
          </p>
          <h1 className="mt-3 text-4xl font-black">Privacy Policy</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Effective 30 June 2026. This page describes the intended ComePlayers privacy model. Final production wording should be reviewed for the countries in which the marketplace operates.
          </p>

          <div className="mt-8 grid gap-5">
            {sections.map(([title, body]) => (
              <section key={title} className="rounded-2xl border border-white/8 bg-white/[0.035] p-5">
                <h2 className="text-lg font-black">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
              </section>
            ))}
          </div>

          <p className="mt-8 text-sm text-slate-400">
            Account privacy tools are available from{" "}
            <Link href="/account/privacy" className="font-bold text-cyan-300 hover:text-cyan-200">
              Account Privacy
            </Link>
            , or contact the{" "}
            <Link href="/support" className="font-bold text-cyan-300 hover:text-cyan-200">
              Support Center
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
