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
  const secret = process.env.CRON_SECRET;

  // Dev convenience
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
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const supabase = getAdminSupabase();

  try {
    // 1) Determine "current" week context from earliest kickoff (simple + stable)
    const { data: g, error: gErr } = await supabase
      .from("games")
      .select("season_year, week_number, phase, kickoff_at")
      .order("kickoff_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (gErr) throw gErr;
    if (!g) throw new Error("No games found (cannot determine week context)");

    const season_year = Number(g.season_year);
    const week_number = Number(g.week_number);
    const phase = String(g.phase) as "regular" | "playoffs";

    // 2) Grade picks for that week
    const { data: gradeRes, error: gradeErr } = await supabase.rpc(
      "grade_picks_for_week",
      {
        p_season_year: season_year,
        p_phase: phase,
        p_week_number: week_number,
      }
    );

    if (gradeErr) throw gradeErr;

    const updated_count =
      Array.isArray(gradeRes) && gradeRes[0]?.updated_count != null
        ? Number(gradeRes[0].updated_count)
        : 0;

    const duration_ms = Date.now() - start;

    // 3) Log run
    const { error: insErr } = await supabase.from("grade_runs").insert({
      status: "ok",
      message: "graded picks for current week context",
      duration_ms,
      details: {
        season_year,
        phase,
        week_number,
        updated_count,
        kickoff_at: g.kickoff_at,
      },
    });

    if (insErr) throw insErr;

    return NextResponse.json({
      ok: true,
      season_year,
      phase,
      week_number,
      updated_count,
      duration_ms,
    });
  } catch (e: any) {
    const duration_ms = Date.now() - start;

    // best-effort error log
    try {
      await supabase.from("grade_runs").insert({
        status: "error",
        message: e?.message ?? "Unknown error",
        duration_ms,
        details: { error: String(e) },
      });
    } catch {}

    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}