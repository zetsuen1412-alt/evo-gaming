import { cookies } from "next/headers";
import { formatLocalizedPrice } from "@/lib/localization";

export async function serverFormatPrice(
  amount: string | number | null | undefined
) {
  const cookieStore = await cookies();

  const locale =
    cookieStore.get("cp_locale")?.value || "id-ID";

  const currency =
    cookieStore.get("cp_currency")?.value || "IDR";

  return formatLocalizedPrice(
    amount,
    locale,
    currency
  );
}