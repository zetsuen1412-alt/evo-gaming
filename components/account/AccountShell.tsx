"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

type AccountShellProps = {
  children: ReactNode;
};

const menuItems = [
  { href: "/account", label: "Account", icon: "👤" },
  { href: "/account/connects", label: "Social Connect", icon: "🔗" },
  { href: "/account/security", label: "Privacy & Security", icon: "🛡️" },
  { href: "/account/billing", label: "Billing & Invoice", icon: "🧾" },
  { href: "/account/privacy", label: "Data & Deletion", icon: "🗂️" },
  { href: "/account/verification", label: "Verification", icon: "✅" },
];

export default function AccountShell({ children }: AccountShellProps) {
  const pathname = usePathname();

  return (
    <main className="min-h-screen bg-[#070b16] text-white">
      <div className="border-b border-cyan-500/10 bg-black/40 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
          <Link href="/" className="text-2xl font-black tracking-wide text-cyan-300">
            ComePlayers
          </Link>
          <Link
            href="/"
            className="rounded-full bg-cyan-400 px-5 py-2 text-sm font-bold text-black transition hover:bg-cyan-300"
          >
            Shop now
          </Link>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 md:grid-cols-[260px_1fr]">
        <aside className="h-fit rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mb-2 flex items-center gap-3 rounded-xl px-4 py-4 text-sm transition ${
                  isActive
                    ? "bg-cyan-400 text-black"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span>{item.icon}</span>
                <span className="font-semibold">{item.label}</span>
              </Link>
            );
          })}
        </aside>

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] shadow-2xl shadow-cyan-950/20">
          {children}
        </section>
      </div>
    </main>
  );
}
