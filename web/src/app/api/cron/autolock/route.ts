import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  // Require CRON_SECRET
  const required = process.env.CRON_SECRET;

  // Vercel Cron sends Authorization header
  const auth = req.headers.get("authorization"); // "Bearer <secret>"

  // Allow manual testing via query param
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");

  if (required) {
    const okHeader = auth === `Bearer ${required}`;
    const okQuery = secret === required;

    if (!okHeader && !okQuery) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { ok: false, error: "Missing SUPABASE env vars" },
      { status: 500 }
    );
  }

  // Service role client (server-only)
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { error } = await admin.rpc("autolock_picks_for_all_pools");

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}