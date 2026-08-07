import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ScoreItem = {
  name: string;
  score: string;
};

type ScoreEvent = {
  id: string;
  commence_time: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  scores: ScoreItem[] | null;
  last_update?: string;
};

const TEAM_ABBREVIATIONS: Record<string, string> = {
  "Arizona Cardinals": "ARI",
  "Atlanta Falcons": "ATL",
  "Baltimore Ravens": "BAL",
  "Buffalo Bills": "BUF",
  "Carolina Panthers": "CAR",
  "Chicago Bears": "CHI",
  "Cincinnati Bengals": "CIN",
  "Cleveland Browns": "CLE",
  "Dallas Cowboys": "DAL",
  "Denver Broncos": "DEN",
  "Detroit Lions": "DET",
  "Green Bay Packers": "GB",
  "Houston Texans": "HOU",
  "Indianapolis Colts": "IND",
  "Jacksonville Jaguars": "JAX",
  "Kansas City Chiefs": "KC",
  "Las Vegas Raiders": "LV",
  "Los Angeles Chargers": "LAC",
  "Los Angeles Rams": "LAR",
  "Miami Dolphins": "MIA",
  "Minnesota Vikings": "MIN",
  "New England Patriots": "NE",
  "New Orleans Saints": "NO",
  "New York Giants": "NYG",
  "New York Jets": "NYJ",
  "Philadelphia Eagles": "PHI",
  "Pittsburgh Steelers": "PIT",
  "San Francisco 49ers": "SF",
  "Seattle Seahawks": "SEA",
  "Tampa Bay Buccaneers": "TB",
  "Tennessee Titans": "TEN",
  "Washington Commanders": "WAS",
};

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function isAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;

  if (process.env.NODE_ENV !== "production") return true;
  if (!secret) return false;

  const auth = req.headers.get("authorization") || "";

  if (auth.startsWith("Bearer ") && auth.slice(7) === secret) {
    return true;
  }

  const url = new URL(req.url);

  if (url.searchParams.get("secret") === secret) {
    return true;
  }

  return false;
}

function getScore(event: ScoreEvent, teamName: string) {
  const row = event.scores?.find((score) => score.name === teamName);

  if (!row) return null;

  const score = Number(row.score);

  return Number.isFinite(score) ? score : null;
}

export async function GET(req: Request) {
  const start = Date.now();

  if (!isAuthorized(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const apiKey = process.env.ODDS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "Missing ODDS_API_KEY" },
      { status: 500 }
    );
  }

  try {
    const supabase = getAdminSupabase();

    const url = new URL(
      "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/scores"
    );

    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("daysFrom", "3");
    url.searchParams.set("dateFormat", "iso");

    const res = await fetch(url.toString(), {
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text();

      throw new Error(
        `Scores API request failed (${res.status}): ${body}`
      );
    }

    const data = (await res.json()) as ScoreEvent[];

    if (!Array.isArray(data)) {
      throw new Error("Scores API returned an unexpected response");
    }

    let updated = 0;
    let live = 0;
    let final = 0;
    let scheduled = 0;
    let unmatched = 0;
    let skippedOutsideWindow = 0;

    const now = Date.now();
    const twoHoursFromNow = now + 2 * 60 * 60 * 1000;
    const eightHoursAgo = now - 8 * 60 * 60 * 1000;
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

    const unmatchedGames: Array<{
      awayTeam: string;
      homeTeam: string;
      commenceTime: string;
    }> = [];

    for (const event of data) {
      const kickoffTime = new Date(event.commence_time).getTime();

      const inActiveGameWindow =
        kickoffTime >= eightHoursAgo &&
        kickoffTime <= twoHoursFromNow;

      const recentlyCompleted =
        event.completed &&
        kickoffTime >= twentyFourHoursAgo;

      if (!inActiveGameWindow && !recentlyCompleted) {
        skippedOutsideWindow++;
        continue;
      }

      const homeTeam = TEAM_ABBREVIATIONS[event.home_team];
      const awayTeam = TEAM_ABBREVIATIONS[event.away_team];

      if (!homeTeam || !awayTeam) {
        unmatched++;
        unmatchedGames.push({
          awayTeam: event.away_team,
          homeTeam: event.home_team,
          commenceTime: event.commence_time,
        });
        continue;
      }

      const kickoff = new Date(event.commence_time);

      const windowStart = new Date(
        kickoff.getTime() - 12 * 60 * 60 * 1000
      ).toISOString();

      const windowEnd = new Date(
        kickoff.getTime() + 12 * 60 * 60 * 1000
      ).toISOString();

      const { data: matchingGames, error: matchError } = await supabase
        .from("games")
        .select("id, kickoff_at")
        .eq("home_team", homeTeam)
        .eq("away_team", awayTeam)
        .gte("kickoff_at", windowStart)
        .lte("kickoff_at", windowEnd)
        .limit(1);

      if (matchError) {
        throw matchError;
      }

      const game = matchingGames?.[0];

      if (!game) {
        unmatched++;
        unmatchedGames.push({
          awayTeam,
          homeTeam,
          commenceTime: event.commence_time,
        });
        continue;
      }

      const homeScore = getScore(event, event.home_team);
      const awayScore = getScore(event, event.away_team);

      let status = "scheduled";
      let winnerTeam: string | null = null;

      if (event.completed) {
        status = "final";
        final++;

        if (
          homeScore !== null &&
          awayScore !== null &&
          homeScore !== awayScore
        ) {
          winnerTeam = homeScore > awayScore ? homeTeam : awayTeam;
        }
      } else if (homeScore !== null || awayScore !== null) {
        status = "live";
        live++;
      } else {
        scheduled++;
      }

      const { error: updateError } = await supabase
        .from("games")
        .update({
          home_score: homeScore,
          away_score: awayScore,
          status,
          winner_team: winnerTeam,
          score_updated_at: new Date().toISOString(),
        })
        .eq("id", game.id);

      if (updateError) {
        throw updateError;
      }

      updated++;
    }

    return NextResponse.json({
      ok: true,
      score_events_received: data.length,
      games_updated: updated,
      games_live: live,
      games_final: final,
      games_scheduled: scheduled,
      games_unmatched: unmatched,
      games_skipped_outside_window: skippedOutsideWindow,
      unmatched_games: unmatchedGames.slice(0, 10),
      duration_ms: Date.now() - start,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        ok: false,
        error: message,
        duration_ms: Date.now() - start,
      },
      { status: 500 }
    );
  }
}
