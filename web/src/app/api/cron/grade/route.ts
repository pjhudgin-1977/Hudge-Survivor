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
    // 1) Determine "current" week context from earliest kickoff
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

    const graded_updated_count =
      Array.isArray(gradeRes) && gradeRes[0]?.updated_count != null
        ? Number(gradeRes[0].updated_count)
        : 0;

    // 3) Apply losses across ALL pools (double elimination handled in SQL function)
    const { data: pools, error: poolsErr } = await supabase
      .from("pools")
      .select("id");

    if (poolsErr) throw poolsErr;

    let pools_processed = 0;
    let total_marked_picks = 0;
    let total_updated_members = 0;

    for (const p of pools ?? []) {
      const poolId = String(p.id);

      const { data: lossRes, error: lossErr } = await supabase.rpc(
        "apply_losses_for_week",
        {
          p_pool_id: poolId,
          p_season_year: season_year,
          p_phase: phase,
          p_week_number: week_number,
        }
      );

      if (lossErr) throw lossErr;

      const updated_members =
        Array.isArray(lossRes) && lossRes[0]?.updated_members != null
          ? Number(lossRes[0].updated_members)
          : 0;

      const marked_picks =
        Array.isArray(lossRes) && lossRes[0]?.marked_picks != null
          ? Number(lossRes[0].marked_picks)
          : 0;

      pools_processed += 1;
      total_updated_members += updated_members;
      total_marked_picks += marked_picks;
    }

    const duration_ms = Date.now() - start;

    // 4) Log run
    const details = {
      season_year,
      phase,
      week_number,
      kickoff_at: g.kickoff_at,

      graded_updated_count,

      pools_processed,
      total_marked_picks,
      total_updated_members,
    };

    const { error: insErr } = await supabase.from("grade_runs").insert({
      status: "ok",
      message: "graded picks + applied losses",
      duration_ms,
      details,
    });
    if (insErr) throw insErr;

    return NextResponse.json({ ok: true, ...details, duration_ms });
  } catch (e: any) {
    const duration_ms = Date.now() - start;

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