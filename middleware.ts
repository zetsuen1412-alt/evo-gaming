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
  EU: { locale: "en-US", currency: "EUR" },
};

function getLocaleConfig(countryCode: string | null): LocaleConfig {
  const code = String(countryCode || "ID").toUpperCase();
  return COUNTRY_LOCALE_MAP[code] || COUNTRY_LOCALE_MAP.ID;
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const country =
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("cf-ipcountry") ||
    "ID";

  const config = getLocaleConfig(country);

  response.cookies.set("cp_country", country.toUpperCase(), {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
  });

  response.cookies.set("cp_locale", config.locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
  });

  response.cookies.set("cp_currency", config.currency, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
  });

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};