import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(url, key, {
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
    const url = new URL(req.url);

    const requestedSeason = url.searchParams.get("season");
    const requestedWeek = url.searchParams.get("week");
    const requestedPhase = url.searchParams.get("phase");

    let season_year: number;
    let week_number: number;
    let phase: string;
    let kickoff_at: string | null = null;

    // Manual test mode:
    // /api/cron/grade?season=2026&week=2&phase=regular&secret=...
    if (requestedSeason && requestedWeek) {
      season_year = Number(requestedSeason);
      week_number = Number(requestedWeek);
      phase = requestedPhase || "regular";

      if (
        !Number.isFinite(season_year) ||
        !Number.isFinite(week_number) ||
        week_number < 1
      ) {
        return NextResponse.json(
          { ok: false, error: "Invalid season or week" },
          { status: 400 }
        );
      }
    } else {
      // Normal cron mode:
      // Find the most recent week containing at least one final game.
      const { data: g, error: gameErr } = await supabase
        .from("games")
        .select("season_year, week_number, phase, kickoff_at")
        .eq("status", "final")
        .order("kickoff_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (gameErr) throw gameErr;
      if (!g) throw new Error("No completed games found");

      season_year = Number(g.season_year);
      week_number = Number(g.week_number);
      phase = String(g.phase);
      kickoff_at = g.kickoff_at;
    }

    const { data: gradeRes, error: gradeErr } = await supabase.rpc(
      "grade_picks_for_week",
      {
        p_season_year: season_year,
        p_phase: phase,
        p_week_number: week_number,
      }
    );

    if (gradeErr) throw gradeErr;

    const gradeRow = Array.isArray(gradeRes) ? gradeRes[0] : gradeRes;
    const graded_updated_count = Number(gradeRow?.updated_count ?? 0);

    const { data: pools, error: poolsErr } = await supabase
      .from("pools")
      .select("id");

    if (poolsErr) throw poolsErr;

    let pools_processed = 0;
    let total_marked_picks = 0;
    let total_updated_members = 0;
    let total_resynced_members = 0;

    for (const pool of pools ?? []) {
      const { data: lossRes, error: lossErr } = await supabase.rpc(
        "apply_losses_for_week",
        {
          p_pool_id: pool.id,
          p_season_year: season_year,
          p_phase: phase,
          p_week_number: week_number,
        }
      );

      if (lossErr) throw lossErr;

      const lossRow = Array.isArray(lossRes) ? lossRes[0] : lossRes;

      pools_processed++;
      total_marked_picks += Number(lossRow?.marked_picks ?? 0);
      total_updated_members += Number(lossRow?.updated_members ?? 0);

      const { data: syncRes, error: syncErr } = await supabase.rpc(
        "resync_pool_member_losses",
        {
          p_pool_id: pool.id,
        }
      );

      if (syncErr) throw syncErr;

      const syncRow = Array.isArray(syncRes) ? syncRes[0] : syncRes;
      total_resynced_members += Number(syncRow?.updated_members ?? 0);
    }

    const duration_ms = Date.now() - start;

    const details = {
      season_year,
      phase,
      week_number,
      kickoff_at,
      graded_updated_count,
      pools_processed,
      total_marked_picks,
      total_updated_members,
      total_resynced_members,
    };

    await supabase.from("grade_runs").insert({
      status: "ok",
      message: "graded picks + applied losses + resynced pool member losses",
      duration_ms,
      details,
    });

    return NextResponse.json({
      ok: true,
      ...details,
      duration_ms,
    });
  } catch (e: any) {
    const duration_ms = Date.now() - start;
    const message = e?.message ?? "Server error";

    try {
      await supabase.from("grade_runs").insert({
        status: "error",
        message,
        duration_ms,
        details: { error: String(e) },
      });
    } catch {}

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}