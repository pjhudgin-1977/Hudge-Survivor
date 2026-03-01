import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Phase = "regular" | "playoffs" | string;

function makeLabel(phase: Phase, weekNumber: number) {
  const p = String(phase).toLowerCase();
  const isPlayoffs = p.includes("playoff");
  return isPlayoffs ? `Playoff W${weekNumber}` : `Week ${weekNumber}`;
}

export async function GET(
  _req: Request,
  { params }: { params: { poolId: string } }
) {
  const supabase = await createClient();

  // Auth required (keeps pool info private)
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const nowIso = now.toISOString();

  // 1) Determine "current week" as: next upcoming game (fallback earliest game)
  const { data: nextGame, error: nextErr } = await supabase
    .from("games")
    .select("kickoff_at, season_year, week_number, phase")
    .gte("kickoff_at", nowIso)
    .order("kickoff_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let game = nextGame;

  if (!game) {
    const { data: earliest, error: earliestErr } = await supabase
      .from("games")
      .select("kickoff_at, season_year, week_number, phase")
      .order("kickoff_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!earliest) {
      return NextResponse.json(
        { error: earliestErr?.message || nextErr?.message || "no games" },
        { status: 404 }
      );
    }

    game = earliest;
  }

  const kickoffAt = new Date(game.kickoff_at);
  const msUntilLock = kickoffAt.getTime() - now.getTime();
  const isLocked = msUntilLock <= 0;

  return NextResponse.json({
    poolId: params.poolId,
    season_year: game.season_year,
    phase: game.phase,
    week_number: game.week_number,
    label: makeLabel(game.phase, Number(game.week_number)),
    kickoff_at: game.kickoff_at,
    is_locked: isLocked,
    ms_until_lock: Math.max(0, msUntilLock),
    server_now: nowIso,
  });
}