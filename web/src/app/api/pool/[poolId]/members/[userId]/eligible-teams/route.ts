import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

function normalizePhase(p: string | null | undefined) {
  const s = String(p ?? "").toLowerCase();
  if (s.includes("play")) return "playoffs";
  return "regular";
}

export async function GET(
  req: Request,
  context: { params: Promise<{ poolId: string; userId: string }> }
) {
  const supabase = await createClient();
  const { poolId, userId } = await context.params;

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

  const url = new URL(req.url);
  const entryNoRaw = url.searchParams.get("entryNo");
  const entryNo = Number(entryNoRaw || "1");

  if (!Number.isFinite(entryNo) || entryNo < 1) {
    return NextResponse.json(
      { error: `Invalid entryNo: ${String(entryNoRaw)}` },
      { status: 400 }
    );
  }

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

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

  const nowIso = new Date().toISOString();

  const { data: nextGame, error: nextErr } = await supabase
    .from("games")
    .select("season_year, week_number, phase, kickoff_at")
    .gte("kickoff_at", nowIso)
    .order("kickoff_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let currentGame = nextGame;

  if (nextErr || !currentGame) {
    const { data: lastGame, error: lastErr } = await supabase
      .from("games")
      .select("season_year, week_number, phase, kickoff_at")
      .order("kickoff_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastErr || !lastGame) {
      return NextResponse.json(
        { error: "Could not determine current week" },
        { status: 500 }
      );
    }

    currentGame = lastGame;
  }

  const seasonYear = currentGame.season_year;
  const weekNumber = currentGame.week_number;
  const phase = currentGame.phase;

  const { data: weekGames, error: weekErr } = await supabase
    .from("games")
    .select("home_team, away_team")
    .eq("season_year", seasonYear)
    .eq("week_number", weekNumber)
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

  const normalizedPhase = normalizePhase(phase);

  const { data: pastPicks, error: picksErr } = await supabase
    .from("picks")
    .select("picked_team, phase")
    .eq("pool_id", poolId)
    .eq("user_id", userId)
    .eq("entry_no", entryNo)
    .not("picked_team", "is", null);

  if (picksErr) {
    return NextResponse.json(
      { error: `Failed to load picks: ${picksErr.message}` },
      { status: 500 }
    );
  }

  const used = new Set<string>();
  for (const p of pastPicks ?? []) {
    if (normalizePhase(p.phase) !== normalizedPhase) continue;
    if (p.picked_team) used.add(String(p.picked_team).toUpperCase());
  }

  const eligible = Array.from(weekTeams)
    .filter((t) => !used.has(t))
    .sort();

  return NextResponse.json({
    ok: true,
    entry_no: entryNo,
    week_number: weekNumber,
    phase,
    teams: eligible,
  });
}