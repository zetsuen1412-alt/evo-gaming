import { NextRequest, NextResponse } from "next/server";

type LocaleConfig = {
  locale: string;
  currency: string;
};

const COUNTRY_LOCALE_MAP: Record<string, LocaleConfig> = {
  ID: { locale: "id-ID", currency: "IDR" },
  US: { locale: "en-US", currency: "USD" },
  GB: { locale: "en-GB", currency: "GBP" },
  SG: { locale: "en-SG", currency: "SGD" },
  MY: { locale: "ms-MY", currency: "MYR" },
  PH: { locale: "en-PH", currency: "PHP" },
  TH: { locale: "th-TH", currency: "THB" },
  VN: { locale: "vi-VN", currency: "VND" },
  JP: { locale: "ja-JP", currency: "JPY" },
  KR: { locale: "ko-KR", currency: "KRW" },
  AU: { locale: "en-AU", currency: "AUD" },
  CA: { locale: "en-CA", currency: "CAD" },
  EU: { locale: "en-IE", currency: "EUR" },
};

const EUROZONE_COUNTRIES = new Set([
  "AT",
  "BE",
  "HR",
  "CY",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PT",
  "SK",
  "SI",
  "ES",
]);

function getLocaleConfig(countryCode: string | null): LocaleConfig {
  const code = String(countryCode || "ID").toUpperCase();

  if (EUROZONE_COUNTRIES.has(code)) {
    const locale = code === "DE" ? "de-DE" : code === "FR" ? "fr-FR" : "en-IE";
    return { locale, currency: "EUR" };
  }

  return COUNTRY_LOCALE_MAP[code] || COUNTRY_LOCALE_MAP.ID;
}

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  const country = (
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("cf-ipcountry") ||
    "ID"
  ).toUpperCase();

  // A future currency selector can set cp_currency_source=manual so Proxy
  // does not overwrite an explicit user preference.
  const hasManualPreference =
    request.cookies.get("cp_currency_source")?.value === "manual";

  if (!hasManualPreference) {
    const config = getLocaleConfig(country);
    const commonOptions = {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax" as const,
      secure: request.nextUrl.protocol === "https:",
    };

    response.cookies.set("cp_country", country, commonOptions);
    response.cookies.set("cp_locale", config.locale, commonOptions);
    response.cookies.set("cp_currency", config.currency, commonOptions);
    response.cookies.set("cp_currency_source", "geo", commonOptions);
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
