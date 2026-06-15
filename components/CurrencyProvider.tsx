"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useMemo,
} from "react";
import { formatLocalizedPrice } from "@/lib/localization";

type CurrencyContextValue = {
  country: string;
  locale: string;
  currency: string;
  formatPrice: (amountIdr: string | number | null | undefined) => string;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({
  children,
  country,
  locale,
  currency,
}: {
  children: ReactNode;
  country: string;
  locale: string;
  currency: string;
}) {
  const value = useMemo<CurrencyContextValue>(() => {
    return {
      country,
      locale,
      currency,
      formatPrice: (amountIdr) =>
        formatLocalizedPrice(amountIdr, locale, currency),
    };
  }, [country, currency, locale]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);

  if (!context) {
    return {
      country: "ID",
      locale: "id-ID",
      currency: "IDR",
      formatPrice: (amountIdr: string | number | null | undefined) =>
        formatLocalizedPrice(amountIdr, "id-ID", "IDR"),
    };
  }

  return context;
}