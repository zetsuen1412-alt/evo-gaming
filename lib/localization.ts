export type SupportedCurrency =
  | "IDR"
  | "USD"
  | "EUR"
  | "GBP"
  | "SGD"
  | "MYR"
  | "PHP"
  | "THB"
  | "VND"
  | "JPY"
  | "KRW"
  | "AUD"
  | "CAD";

export const BASE_CURRENCY = "IDR";

export type ExchangeRate = {
  currency: SupportedCurrency;
  idr_per_unit: number;
  margin_percent: number;
};

export const FALLBACK_EXCHANGE_RATES: Record<SupportedCurrency, ExchangeRate> = {
  IDR: { currency: "IDR", idr_per_unit: 1, margin_percent: 0 },
  USD: { currency: "USD", idr_per_unit: 16250, margin_percent: 2.5 },
  EUR: { currency: "EUR", idr_per_unit: 18500, margin_percent: 2.5 },
  GBP: { currency: "GBP", idr_per_unit: 21500, margin_percent: 2.5 },
  SGD: { currency: "SGD", idr_per_unit: 12750, margin_percent: 2.5 },
  MYR: { currency: "MYR", idr_per_unit: 3450, margin_percent: 2.5 },
  PHP: { currency: "PHP", idr_per_unit: 285, margin_percent: 2.5 },
  THB: { currency: "THB", idr_per_unit: 450, margin_percent: 2.5 },
  VND: { currency: "VND", idr_per_unit: 0.65, margin_percent: 2.5 },
  JPY: { currency: "JPY", idr_per_unit: 112, margin_percent: 2.5 },
  KRW: { currency: "KRW", idr_per_unit: 12, margin_percent: 2.5 },
  AUD: { currency: "AUD", idr_per_unit: 10600, margin_percent: 2.5 },
  CAD: { currency: "CAD", idr_per_unit: 11900, margin_percent: 2.5 },
};

export function parseIdrAmount(value: string | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  return Number(String(value).replace(/[^\d]/g, "") || 0);
}

export function normalizeCurrency(value: string | null | undefined) {
  const currency = String(value || "IDR").toUpperCase() as SupportedCurrency;
  return FALLBACK_EXCHANGE_RATES[currency] ? currency : "IDR";
}

export function getFallbackExchangeRate(
  currency: string | null | undefined
): ExchangeRate {
  return FALLBACK_EXCHANGE_RATES[normalizeCurrency(currency)];
}

export function convertFromIdr(
  amountIdr: string | number | null | undefined,
  currency: string | null | undefined,
  exchangeRate?: Partial<ExchangeRate> | null
) {
  const amount = parseIdrAmount(amountIdr);
  const safeCurrency = normalizeCurrency(currency);

  if (safeCurrency === "IDR") return amount;

  const fallback = getFallbackExchangeRate(safeCurrency);

  const idrPerUnit = Number(exchangeRate?.idr_per_unit || fallback.idr_per_unit);
  const marginPercent = Number(
    exchangeRate?.margin_percent ?? fallback.margin_percent
  );

  const marketplaceRate = idrPerUnit * (1 + marginPercent / 100);

  if (!marketplaceRate || marketplaceRate <= 0) return amount;

  return amount / marketplaceRate;
}

export function formatLocalizedPrice(
  amountIdr: string | number | null | undefined,
  locale = "id-ID",
  currency = "IDR",
  exchangeRate?: Partial<ExchangeRate> | null
) {
  const safeCurrency = normalizeCurrency(currency);
  const converted = convertFromIdr(amountIdr, safeCurrency, exchangeRate);

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: safeCurrency,
    maximumFractionDigits:
      safeCurrency === "IDR" ||
      safeCurrency === "JPY" ||
      safeCurrency === "KRW" ||
      safeCurrency === "VND"
        ? 0
        : 2,
  }).format(converted);
}