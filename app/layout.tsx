import type { Metadata } from "next";
import { cookies } from "next/headers";
import { CurrencyProvider } from "@/components/CurrencyProvider";
import MainHeader from "./components/MainHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "ComePlayers",
  description: "Trusted gaming marketplace powered by EvoGaming.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();

  const country = cookieStore.get("cp_country")?.value || "ID";
  const locale = cookieStore.get("cp_locale")?.value || "id-ID";
  const currency = cookieStore.get("cp_currency")?.value || "IDR";

  return (
    <html
      lang={locale}
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-[#020617] text-white">
        <CurrencyProvider country={country} locale={locale} currency={currency}>
          <MainHeader />
          {children}
        </CurrencyProvider>
      </body>
    </html>
  );
}