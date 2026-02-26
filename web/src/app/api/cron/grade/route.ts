import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isAuthorized(req: Request) {
  // Use the same secret pattern you used for autolock (recommended).
  // Supports either:
  //   Authorization: Bearer <secret>
  //   or ?secret=<secret>
  const secret = process.env.CRON_SECRET;

  // Dev convenience: allow calling without a secret locally
  if (process.env.NODE_ENV !== "production") return true;

  if (!secret) return false;

  const auth = req.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ") && auth.slice(7) === secret) return true;

  const url = new URL(req.url);
  if (url.searchParams.get("secret") === secret) return true;

  return false;
}

export async function GET(req: Request) {
  const start = Date.now();

  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getAdminSupabase();

  try {
    // ✅ For now: just write a run-log row proving the cron route works
    const { error: insErr } = await supabase.from("grade_runs").insert({
      status: "ok",
      message: "grade cron route reached (stub)",
      duration_ms: Date.now() - start,
      details: { phase: "stub" },
    });

    if (insErr) throw insErr;

    return NextResponse.json({
      ok: true,
      message: "Grade cron stub ran and logged successfully.",
      duration_ms: Date.now() - start,
    });
  } catch (e: any) {
    // Log the error too (best-effort)
    try {
      await supabase.from("grade_runs").insert({
        status: "error",
        message: e?.message ?? "Unknown error",
        duration_ms: Date.now() - start,
        details: { error: String(e) },
      });
    } catch {}

    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}