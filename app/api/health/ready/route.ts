import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/serverSupabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  const missing = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "CRON_SECRET",
  ].filter((name) => !String(process.env[name] || "").trim());

  let databaseOk = false;
  let databaseError: string | null = null;
  try {
    const supabaseAdmin = createSupabaseAdmin();
    const { error } = await supabaseAdmin.from("game_master").select("id").limit(1);
    if (error) throw new Error(error.message);
    databaseOk = true;
  } catch (error) {
    databaseError = error instanceof Error ? error.message : "Database readiness failed.";
  }

  const ok = missing.length === 0 && databaseOk;
  return NextResponse.json(
    {
      ok,
      service: "comeplayers-web",
      environment: process.env.PAYPAL_ENV === "live" ? "live" : "sandbox",
      dependencies: {
        database: databaseOk ? "ready" : "unavailable",
      },
      missingConfiguration: missing,
      error: databaseError,
      responseTimeMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    {
      status: ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
