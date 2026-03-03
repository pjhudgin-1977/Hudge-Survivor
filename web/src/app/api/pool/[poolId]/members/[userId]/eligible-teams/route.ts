import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

export async function GET(
  req: Request,
  ctx: {
    params:
      | { poolId: string; userId: string }
      | Promise<{ poolId: string; userId: string }>;
  }
) {
  const supabase = await createClient();
  const { poolId, userId } = await Promise.resolve(ctx.params);

  if (!poolId || !userId || !isUuid(poolId) || !isUuid(userId)) {
    return NextResponse.json(
      {
        error: `Invalid params: poolId=${String(poolId)} userId=${String(
          userId
        )}`,
      },
      { status: 400 }
    );
  }

  // Must be logged in
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Must be commissioner
  const { data: isComm, error: commErr } = await supabase.rpc(
    "is_pool_commissioner",
    { pid: poolId }
  );
  if (commErr) {
    return NextResponse.json(
      { error: `Commissioner check failed: ${commErr.message}` },
      { status: 500 }
    );
  }
  if (!isComm) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Determine current week from next upcoming game
  const nowIso = new Date().toISOString();
  const { data: nextGame, error: gameErr } = await supabase
    .from("games")
    .select("season_year, week_number, phase, kickoff_at")
    .gte("kickoff_at", nowIso)
    .order("kickoff_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (gameErr || !nextGame) {
    return NextResponse.json(
      { error: "Could not determine current week" },
      { status: 500 }
    );
  }

  const { season_year, week_number, phase } = nextGame;

  // Teams playing this week
  const { data: weekGames, error: weekErr } = await supabase
    .from("games")
    .select("home_team, away_team")
    .eq("season_year", season_year)
    .eq("week_number", week_number)
    .eq("phase", phase);

  if (weekErr) {
    return NextResponse.json(
      { error: `Failed to load games: ${weekErr.message}` },
      { status: 500 }
    );
  }

  const weekTeams = new Set<string>();
  for (const g of weekGames ?? []) {
    if (g.home_team) weekTeams.add(String(g.home_team).toUpperCase());
    if (g.away_team) weekTeams.add(String(g.away_team).toUpperCase());
  }

  // Exclude teams already used by this member in this PHASE (no season_year column in picks)
  const { data: pastPicks, error: picksErr } = await supabase
    .from("picks")
    .select("picked_team")
    .eq("pool_id", poolId)
    .eq("user_id", userId)
    .eq("phase", phase)
    .not("picked_team", "is", null);

  if (picksErr) {
    return NextResponse.json(
      { error: `Failed to load picks: ${picksErr.message}` },
      { status: 500 }
    );
  }

  const used = new Set<string>();
  for (const p of pastPicks ?? []) {
    if (p.picked_team) used.add(String(p.picked_team).toUpperCase());
  }

  const eligible = Array.from(weekTeams).filter((t) => !used.has(t)).sort();

  return NextResponse.json({
    ok: true,
    week_number,
    phase,
    teams: eligible,
  });
}