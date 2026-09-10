import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ReqBody = {
  season_year: number;
  week_number: number;
  phase: "regular" | "playoffs";
  seasontype: 2 | 3;
};

function mapStatus(
  espnState?: string,
  espnName?: string
): "scheduled" | "live" | "final" {
  const s = (espnState || espnName || "").toLowerCase();

  if (s.includes("post") || s.includes("final")) return "final";
  if (s.includes("in") || s.includes("live")) return "live";

  return "scheduled";
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Use POST", { status: 405 });
    }

    const syncSecret = Deno.env.get("ESPN_SYNC_SECRET") ?? "";
    const provided = req.headers.get("x-sync-secret") ?? "";

    if (!syncSecret || provided !== syncSecret) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = (await req.json()) as ReqBody;

    if (
      !body.season_year ||
      !body.week_number ||
      !body.phase ||
      !body.seasontype
    ) {
      return new Response("Missing required fields", { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const sb = createClient(supabaseUrl, serviceRoleKey);

    const url =
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard` +
      `?dates=${body.season_year}` +
      `&seasontype=${body.seasontype}` +
      `&week=${body.week_number}`;

    const resp = await fetch(url, {
      headers: {
        "User-Agent": "hudge-survivor-pool/1.0",
        Accept: "application/json",
      },
    });

    if (!resp.ok) {
      const txt = await resp.text();

      return new Response(
        `ESPN fetch failed: ${resp.status} ${txt}`,
        { status: 502 }
      );
    }

    const data = await resp.json();

    const events: any[] = Array.isArray(data?.events)
      ? data.events
      : [];

    let updated = 0;
    let inserted = 0;
    let skipped = 0;

    for (const e of events) {
      const eventId = String(e?.id ?? "");
      const comp = e?.competitions?.[0];

      if (!eventId || !comp) {
        skipped++;
        continue;
      }

      const kickoffAt = comp?.date ?? null;

      const statusType = comp?.status?.type;

      const status = mapStatus(
        statusType?.state,
        statusType?.name
      );

      const competitors: any[] = Array.isArray(comp?.competitors)
        ? comp.competitors
        : [];

      const home = competitors.find(
        (c) => c?.homeAway === "home"
      );

      const away = competitors.find(
        (c) => c?.homeAway === "away"
      );

      if (!home || !away) {
        skipped++;
        continue;
      }

      const normalizeTeam = (abbr: string) =>
        abbr === "WSH" ? "WAS" : abbr;

      const homeAbbr = normalizeTeam(
        String(home?.team?.abbreviation ?? "")
      );

      const awayAbbr = normalizeTeam(
        String(away?.team?.abbreviation ?? "")
      );

      if (!homeAbbr || !awayAbbr) {
        skipped++;
        continue;
      }

      const homeScore = Number(home?.score ?? 0);
      const awayScore = Number(away?.score ?? 0);

      let winnerTeam: string | null = null;
      let wasTie = false;

      if (status === "final") {
        if (homeScore === awayScore) {
          wasTie = true;
        } else if (home?.winner === true) {
          winnerTeam = homeAbbr;
        } else if (away?.winner === true) {
          winnerTeam = awayAbbr;
        } else {
          winnerTeam =
            homeScore > awayScore
              ? homeAbbr
              : awayAbbr;
        }
      }

      const { data: existingRows, error: lookupError } = await sb
        .from("games")
        .select("id, provider_event_id")
        .eq("season_year", body.season_year)
        .eq("week_number", body.week_number)
        .eq("phase", body.phase)
        .eq("home_team", homeAbbr)
        .eq("away_team", awayAbbr);

      if (lookupError) {
        return new Response(
          `Game lookup failed: ${lookupError.message}`,
          { status: 500 }
        );
      }

      const rows = existingRows ?? [];

      const existing =
        rows.find((row) =>
          String(row.provider_event_id ?? "").startsWith(
            `${body.season_year}-`
          )
        ) ?? rows[0];

      const gameValues = {
        kickoff_at: kickoffAt,
        status,
        home_score: homeScore,
        away_score: awayScore,
        winner_team: winnerTeam,
        was_tie: wasTie,
        score_updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { error: updateError } = await sb
          .from("games")
          .update(gameValues)
          .eq("id", existing.id);

        if (updateError) {
          return new Response(
            `Game update failed: ${updateError.message}`,
            { status: 500 }
          );
        }

        updated++;
      } else {
        const { error: insertError } = await sb
          .from("games")
          .insert({
            provider_event_id: eventId,
            season_year: body.season_year,
            week_number: body.week_number,
            phase: body.phase,
            home_team: homeAbbr,
            away_team: awayAbbr,
            ...gameValues,
          });

        if (insertError) {
          return new Response(
            `Game insert failed: ${insertError.message}`,
            { status: 500 }
          );
        }

        inserted++;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        events: events.length,
        updated,
        inserted,
        skipped,
        season_year: body.season_year,
        week_number: body.week_number,
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    return new Response(
      `Error: ${(err as Error).message}`,
      { status: 500 }
    );
  }
});