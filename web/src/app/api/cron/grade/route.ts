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
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getAdminSupabase();

  try {
    // ---- determine week context ----
    const { data: g } = await supabase
      .from("games")
      .select("season_year, week_number, phase, kickoff_at")
      .order("kickoff_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!g) throw new Error("No games found");

    const season_year = Number(g.season_year);
    const week_number = Number(g.week_number);
    const phase = String(g.phase);

    // ---- grade picks ----
    const { data: gradeRes } = await supabase.rpc("grade_picks_for_week", {
      p_season_year: season_year,
      p_phase: phase,
      p_week_number: week_number,
    });

    const graded_updated_count =
      Array.isArray(gradeRes) ? Number(gradeRes[0]?.updated_count ?? 0) : 0;

    // ---- apply losses across all pools ----
    const { data: pools, error: poolsErr } = await supabase.from("pools").select("id");
    if (poolsErr) throw poolsErr;

    let pools_processed = 0;
    let total_marked_picks = 0;
    let total_updated_members = 0;
    let total_resynced_members = 0;

    for (const pool of pools ?? []) {
      // 1) mark counted_in_losses / etc (your existing logic)
      const { data: lossRes, error: lossErr } = await supabase.rpc("apply_losses_for_week", {
        p_pool_id: pool.id,
        p_season_year: season_year,
        p_phase: phase,
        p_week_number: week_number,
      });

      if (lossErr) throw lossErr;

      const r = lossRes?.[0] ?? {};
      pools_processed++;
      total_marked_picks += Number(r.marked_picks ?? 0);
      total_updated_members += Number(r.updated_members ?? 0);

      // 2) ✅ NEW: resync pool_members.losses from picks.counted_in_losses
      const { data: syncRes, error: syncErr } = await supabase.rpc(
        "resync_pool_member_losses",
        { p_pool_id: pool.id }
      );

      if (syncErr) throw syncErr;

      // returns [{ updated_members: N }] or { updated_members: N } depending on RPC return
      const syncRow = Array.isArray(syncRes) ? syncRes[0] : syncRes;
      total_resynced_members += Number(syncRow?.updated_members ?? 0);
    }

    const duration_ms = Date.now() - start;

    const details = {
      season_year,
      phase,
      week_number,
      kickoff_at: g.kickoff_at,
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

    return NextResponse.json({ ok: true, ...details, duration_ms });
  } catch (e: any) {
    const duration_ms = Date.now() - start;

    try {
      await supabase.from("grade_runs").insert({
        status: "error",
        message: e.message,
        duration_ms,
        details: { error: String(e) },
      });
    } catch {}

    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}