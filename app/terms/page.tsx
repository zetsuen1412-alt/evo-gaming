import Link from "next/link";

const sections = [
  [
    "Account responsibilities",
    "Keep your credentials secure, provide accurate information, and do not share access with another person. You are responsible for activity performed through your account unless reported promptly as unauthorized.",
  ],
  [
    "Marketplace transactions",
    "Listings must accurately describe the digital product or service. Buyers and sellers must use ComePlayers order, messaging, delivery, dispute, and payout workflows instead of moving protected transactions off-platform.",
  ],
  [
    "Prohibited conduct",
    "Fraud, stolen goods, unauthorized account access, payment abuse, harassment, deceptive listings, and attempts to bypass platform safety controls are prohibited.",
  ],
  [
    "Fees, tax, and payouts",
    "Applicable marketplace fees, seller sales tax, withdrawal tax, provider fees, and currency conversion details are shown or recorded in the relevant order, statement, or payout flow.",
  ],
  [
    "Disputes and enforcement",
    "ComePlayers may review evidence, restrict listings, pause payouts, reverse platform ledger entries, suspend accounts, or take other proportionate action to protect users and the marketplace.",
  ],
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#050816] px-4 py-12 text-white sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm font-bold text-cyan-300 hover:text-cyan-200">
          ← Back to ComePlayers
        </Link>
        <div className="mt-6 rounded-[28px] border border-white/10 bg-[#11162d] p-6 shadow-2xl sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
            Legal
          </p>
          <h1 className="mt-3 text-4xl font-black">ComePlayers Terms</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Effective 30 June 2026. These platform terms summarize the rules for using ComePlayers. The production version should be reviewed for the launch jurisdictions and business entity before public release.
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
            Questions about these terms can be submitted through the{" "}
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
