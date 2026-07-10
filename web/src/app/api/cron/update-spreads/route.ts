import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OddsOutcome = {
  name: string;
  price?: number;
  point?: number;
};

type OddsMarket = {
  key: string;
  outcomes: OddsOutcome[];
};

type OddsBookmaker = {
  key: string;
  title: string;
  markets: OddsMarket[];
};

type OddsEvent = {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsBookmaker[];
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

function getSpread(event: OddsEvent) {
  /*
   * Prefer common US sportsbooks in this order.
   * If none are available, use the first bookmaker that has a spread.
   */
  const preferredBookmakers = [
    "draftkings",
    "fanduel",
    "betmgm",
    "caesars",
  ];

  const sortedBookmakers = [...(event.bookmakers ?? [])].sort((a, b) => {
    const aIndex = preferredBookmakers.indexOf(a.key);
    const bIndex = preferredBookmakers.indexOf(b.key);

    const aRank = aIndex === -1 ? 999 : aIndex;
    const bRank = bIndex === -1 ? 999 : bIndex;

    return aRank - bRank;
  });

  for (const bookmaker of sortedBookmakers) {
    const market = bookmaker.markets?.find(
      (item) => item.key === "spreads"
    );

    if (!market) continue;

    const outcomes = market.outcomes ?? [];

    const favorite = outcomes.find(
      (outcome) =>
        typeof outcome.point === "number" && outcome.point < 0
    );

    if (favorite && typeof favorite.point === "number") {
      return {
        favoriteName: favorite.name,
        pointSpread: favorite.point,
        bookmaker: bookmaker.title,
      };
    }

    const pickEm = outcomes.find(
      (outcome) =>
        typeof outcome.point === "number" && outcome.point === 0
    );

    if (pickEm) {
      return {
        favoriteName: null,
        pointSpread: 0,
        bookmaker: bookmaker.title,
      };
    }
  }

  return null;
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
      "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds"
    );

    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("regions", "us");
    url.searchParams.set("markets", "spreads");
    url.searchParams.set("oddsFormat", "american");
    url.searchParams.set("dateFormat", "iso");

    const res = await fetch(url.toString(), {
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text();

      throw new Error(
        `Odds API request failed (${res.status}): ${body}`
      );
    }

    const data = (await res.json()) as OddsEvent[];

    if (!Array.isArray(data)) {
      throw new Error("Odds API returned an unexpected response");
    }

    let updated = 0;
    let unmatched = 0;
    let noSpread = 0;
    const unmatchedGames: Array<{
      awayTeam: string;
      homeTeam: string;
      commenceTime: string;
    }> = [];

    for (const event of data) {
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

      const spread = getSpread(event);

      if (!spread) {
        noSpread++;
        continue;
      }

      const favoriteTeam = spread.favoriteName
        ? TEAM_ABBREVIATIONS[spread.favoriteName]
        : null;

      if (spread.favoriteName && !favoriteTeam) {
        unmatched++;
        unmatchedGames.push({
          awayTeam: event.away_team,
          homeTeam: event.home_team,
          commenceTime: event.commence_time,
        });
        continue;
      }

      /*
       * Kickoff times from different providers can vary slightly.
       * Match the home/away teams and use a 12-hour window around kickoff.
       */
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

      const { error: updateError } = await supabase
        .from("games")
        .update({
          favorite_team: favoriteTeam,
          point_spread: spread.pointSpread,
          spread_last_updated: new Date().toISOString(),
        })
        .eq("id", game.id);

      if (updateError) {
        throw updateError;
      }

      updated++;
    }

    return NextResponse.json({
      ok: true,
      odds_events_received: data.length,
      games_updated: updated,
      games_unmatched: unmatched,
      events_without_spread: noSpread,
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