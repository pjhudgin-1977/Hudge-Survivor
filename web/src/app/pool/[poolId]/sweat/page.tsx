import { redirect } from "next/navigation";
import React from "react";
import { createClient } from "@/lib/supabase/server";
import SweatIntensityMeter from "@/app/_components/SweatIntensityMeter";
import LiveRefresh from "./LiveRefresh";

type PickRow = {
  user_id?: string | null;
  screen_name?: string | null;
  entry_no?: number | null;

  game_id?: string | null;
  kickoff_at?: string | null;
  status?: string | null;
  game_status?: string | null;

  home_team?: string | null;
  away_team?: string | null;
  home_score?: number | null;
  away_score?: number | null;
  winner_team?: string | null;
  was_tie?: boolean | null;

  season_year?: number | null;
  week_number?: number | null;
  phase?: string | null;

  pick_team?: string | null;
  picked_team?: string | null;
  pick_result?: string | null;

  losses?: number | null;
  is_eliminated?: boolean | null;
  still_alive?: boolean | null;
  is_auto?: boolean | null;
};

type GameGroup = {
  game_id: string;
  kickoff_at: string | null;
  status: string | null;
  home_team: string | null;
  away_team: string | null;
  home_score: number | null;
  away_score: number | null;
  winner_team: string | null;
  was_tie: boolean | null;
  favorite_team: string | null;
  point_spread: number | null;
  score_updated_at: string | null;

  season_year: number | null;
  week_number: number | null;
  phase: string | null;

  picks: {
    user_id: string | null;
    screen_name: string;
    entry_no: number | null;
    pick_team: string | null;
    pick_result: string | null;
    losses: number | null;
    is_eliminated: boolean;
    still_alive: boolean;
    is_auto: boolean;
  }[];
};

type PopularityRow = {
  picked_team: string | null;
  pick_count: number | null;
};

function fmtKickoff(d?: string | null) {
  if (!d) return "—";

  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(dt);
}

function fmtScoreUpdated(d?: string | null) {
  if (!d) return null;

  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(dt);
}

function formatSpread(g: GameGroup) {
  if (g.point_spread === null) return "Spread: TBD";

  if (g.point_spread === 0 || !g.favorite_team) {
    return "Spread: Pick'em";
  }

  return `Spread: ${g.favorite_team} ${g.point_spread}`;
}

function isFinalStatus(status?: string | null) {
  const s = String(status ?? "").toLowerCase();
  return (
    s.includes("final") ||
    s.includes("post") ||
    s === "finished" ||
    s === "complete" ||
    s === "completed"
  );
}

function haveScores(g: GameGroup) {
  return typeof g.home_score === "number" && typeof g.away_score === "number";
}

function isComplete(g: GameGroup) {
  return isFinalStatus(g.status) || g.winner_team !== null || g.was_tie === true;
}

function winnerTeam(g: GameGroup): string | null {
  if (g.winner_team) return g.winner_team;
  if (!haveScores(g)) return null;

  const h = g.home_score as number;
  const a = g.away_score as number;

  if (h === a) return null;
  return h > a ? (g.home_team ?? null) : (g.away_team ?? null);
}

function riskScoreForPick(g: GameGroup, pickTeam: string | null, stillAlive: boolean) {
  if (!stillAlive) return 0;
  if (isComplete(g)) return 0;
  if (!haveScores(g)) return 50;

  const home = String(g.home_team ?? "");
  const away = String(g.away_team ?? "");
  const pick = String(pickTeam ?? "");

  let pickScore: number | null = null;
  let oppScore: number | null = null;

  if (pick && home && pick === home) {
    pickScore = g.home_score;
    oppScore = g.away_score;
  } else if (pick && away && pick === away) {
    pickScore = g.away_score;
    oppScore = g.home_score;
  } else {
    const diff = Math.abs((g.home_score ?? 0) - (g.away_score ?? 0));
    return diff <= 3 ? 85 : diff <= 10 ? 55 : 25;
  }

  const margin = (pickScore ?? 0) - (oppScore ?? 0);

  if (margin <= 0) return 95;
  if (margin <= 7) return 65;
  return 30;
}

function riskLabel(score: number) {
  if (score >= 85) return { icon: "😱", label: "Panic" };
  if (score >= 55) return { icon: "😅", label: "Sweat" };
  return { icon: "😌", label: "Chill" };
}

function pickResultBadge(pickResult: string | null, stillAlive: boolean) {
  const r = String(pickResult ?? "").toLowerCase();

  if (r === "win") return { text: "✅ WIN", title: "Win" };
  if (r === "loss" && !stillAlive) return { text: "☠️ OUT", title: "Loss / eliminated" };
  if (r === "loss") return { text: "❌ LOSS", title: "Loss" };

  return null;
}

export default async function SweatPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const supabase = await createClient();
  const { poolId } = await params;

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const me = userRes.user;

  const { data: rows, error } = await supabase
    .from("v_sweat_game_board")
    .select("*")
    .eq("pool_id", poolId)
    .order("kickoff_at", { ascending: true });

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Sweat Board</h1>
        <p style={{ marginTop: 12, color: "crimson" }}>{error.message}</p>
      </main>
    );
  }

  const list = (rows ?? []) as PickRow[];

  const gameIds = Array.from(
    new Set(
      list
        .map((row) => String(row.game_id ?? ""))
        .filter(Boolean)
    )
  );

  const spreadMap = new Map<
    string,
    {
      favorite_team: string | null;
      point_spread: number | null;
      score_updated_at: string | null;
    }
  >();

  if (gameIds.length > 0) {
    const { data: spreadRows } = await supabase
      .from("games")
      .select("id, favorite_team, point_spread, score_updated_at")
      .in("id", gameIds);

    for (const row of spreadRows ?? []) {
      spreadMap.set(String(row.id), {
        favorite_team: row.favorite_team ?? null,
        point_spread:
          typeof row.point_spread === "number"
            ? row.point_spread
            : null,
                score_updated_at: row.score_updated_at ?? null,
        });
    }
  }
  const gamesMap = new Map<string, GameGroup>();

  for (const r of list) {
    const gameId = String(r.game_id ?? "");
    if (!gameId) continue;

    const pickTeam = (r.pick_team ?? r.picked_team ?? null) as string | null;
    const status = (r.game_status ?? r.status ?? null) as string | null;

    if (!gamesMap.has(gameId)) {
      const spread = spreadMap.get(gameId);

      gamesMap.set(gameId, {
        game_id: gameId,
        kickoff_at: (r.kickoff_at ?? null) as string | null,
        status,
        home_team: (r.home_team ?? null) as string | null,
        away_team: (r.away_team ?? null) as string | null,
        home_score: typeof r.home_score === "number" ? r.home_score : null,
        away_score: typeof r.away_score === "number" ? r.away_score : null,
        winner_team: (r.winner_team ?? null) as string | null,
        was_tie: typeof r.was_tie === "boolean" ? r.was_tie : null,
        favorite_team: spread?.favorite_team ?? null,
        point_spread: spread?.point_spread ?? null,
          score_updated_at: spread?.score_updated_at ?? null,

        season_year: typeof r.season_year === "number" ? r.season_year : null,
        week_number: typeof r.week_number === "number" ? r.week_number : null,
        phase: (r.phase ?? null) as string | null,

        picks: [],
      });
    }

    const g = gamesMap.get(gameId)!;

    const screen =
      (r.screen_name && String(r.screen_name).trim()) ||
      (r.user_id ? String(r.user_id).slice(0, 8) : "Player");

    g.picks.push({
      user_id: (r.user_id ?? null) as string | null,
      screen_name: screen,
      entry_no: typeof r.entry_no === "number" ? r.entry_no : null,
      pick_team: pickTeam,
      pick_result: (r.pick_result ?? null) as string | null,
      losses: typeof r.losses === "number" ? r.losses : null,
      is_eliminated: r.is_eliminated === true,
      still_alive: r.still_alive !== false,
      is_auto: r.is_auto === true,
    });
  }

  const games = Array.from(gamesMap.values());

  const nextGame =
    games.find((g) => !isComplete(g) && g.picks.some((p) => p.still_alive)) ??
    games.find((g) => !isComplete(g)) ??
    games[0] ??
    null;

  const popularityContext = nextGame ?? games[0] ?? null;
  const popWeek = popularityContext?.week_number ?? null;
  const popPhase = popularityContext?.phase ?? null;

  let popularity: { team: string; count: number }[] = [];

  if (popWeek != null && popPhase) {
    const { data: popRows } = await supabase
      .from("v_pick_popularity")
      .select("picked_team, pick_count")
      .eq("pool_id", poolId)
      .eq("week_number", popWeek)
      .eq("phase", popPhase);

    const raw = (popRows ?? []) as PopularityRow[];

    popularity = raw
      .filter((r) => r.picked_team)
      .map((r) => ({
        team: String(r.picked_team),
        count: Number(r.pick_count ?? 0),
      }))
      .sort((a, b) => b.count - a.count);
  }

  const popularityTotal = popularity.reduce((a, b) => a + b.count, 0);

  let poolAvg = 0;
  let poolCount = 0;

  let topSweats: {
    score: number;
    screen_name: string;
    pick_team: string | null;
    isMe: boolean;
    isAuto: boolean;
  }[] = [];

  if (nextGame) {
    const activePicks = nextGame.picks.filter((p) => p.still_alive);

    const scores = activePicks.map((p) => {
      const score = riskScoreForPick(nextGame, p.pick_team, p.still_alive);
      return {
        score,
        screen_name: p.screen_name,
        pick_team: p.pick_team,
        isMe: !!(p.user_id && me.id && p.user_id === me.id),
        isAuto: p.is_auto,
      };
    });

    poolCount = scores.length;
    poolAvg =
      scores.length === 0
        ? 0
        : Math.round(scores.reduce((a, b) => a + b.score, 0) / scores.length);

    topSweats = [...scores].sort((a, b) => b.score - a.score);
  }

  const nextGameStarted = nextGame
    ? haveScores(nextGame) || isComplete(nextGame)
    : false;

  const poolMeta = riskLabel(poolAvg);

  const hasLiveGames = games.some(
    (g) => String(g.status ?? "").toLowerCase() === "live"
  );

  const latestScoreUpdate =
    games
      .map((g) => g.score_updated_at)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;

  return (
    <main
      style={{
        maxWidth: 1180,
        margin: "0 auto",
        padding: "24px 18px 40px",
      }}
    >
      <LiveRefresh enabled={hasLiveGames} />

      <header style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>
          Sweat Board
        </h1>

        <div
          style={{
            marginTop: 7,
            fontSize: 13,
            opacity: 0.72,
          }}
        >
          😌 Chill · 😅 Sweat · 😱 Panic · ✅ Done · ☠️ Out
        </div>

        {latestScoreUpdate ? (
          <div
            style={{
              marginTop: 6,
              fontSize: 12,
              fontWeight: 800,
              opacity: 0.72,
            }}
          >
            {hasLiveGames ? "● LIVE · " : ""}
            Scores updated {fmtScoreUpdated(latestScoreUpdate)}
            {hasLiveGames ? " · Auto-refreshing every 30 seconds" : ""}
          </div>
        ) : null}
      </header>

      <div className="sweat-summary-grid">
        <section
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 14,
            padding: 18,
            background: "rgba(255,255,255,0.025)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 14, opacity: 0.72 }}>
                🔥 Pick Popularity
              </div>

              <div style={{ marginTop: 4, fontSize: 18, fontWeight: 900 }}>
                {popWeek != null ? `Week ${popWeek}` : "Current Week"}
              </div>
            </div>

            {popularityTotal > 0 ? (
              <div style={{ fontSize: 13, opacity: 0.72 }}>
                {popularityTotal} picks counted
              </div>
            ) : null}
          </div>

          {popularityTotal === 0 ? (
            <div style={{ opacity: 0.72, fontSize: 13 }}>
              Pick popularity will appear after picks are submitted.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {popularity.slice(0, 10).map((r) => {
                const pct = popularityTotal
                  ? Math.round((r.count / popularityTotal) * 100)
                  : 0;

                return (
                  <div
                    key={r.team}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "48px minmax(100px, 1fr) 78px",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>{r.team}</div>

                    <div
                      style={{
                        width: "100%",
                        maxWidth: 320,
                        height: 9,
                        borderRadius: 999,
                        background: "rgba(255,255,255,0.07)",
                        overflow: "hidden",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                      title={`${r.count} picks (${pct}%)`}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${pct}%`,
                          minWidth: pct > 0 ? 8 : 0,
                          background: "rgba(249,115,22,0.85)",
                        }}
                      />
                    </div>

                    <div
                      style={{
                        textAlign: "right",
                        fontSize: 13,
                        opacity: 0.82,
                      }}
                    >
                      <strong>{r.count}</strong>{" "}
                      <span style={{ opacity: 0.7 }}>({pct}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 14,
            padding: 18,
            background: "rgba(255,255,255,0.025)",
          }}
        >
          <div style={{ fontSize: 14, opacity: 0.72 }}>Pool Sweat</div>

          {nextGame ? (
            <>
              <div
                style={{
                  marginTop: 7,
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                {nextGameStarted ? (
                  <>
                    <div style={{ fontSize: 22, fontWeight: 950 }}>
                      {poolMeta.icon} {poolMeta.label}
                    </div>

                    <div style={{ fontSize: 16, fontWeight: 900 }}>
                      Sweat score: {poolAvg} / 100
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 22, fontWeight: 950 }}>
                    Not started
                  </div>
                )}
              </div>

              {nextGameStarted ? (
                <div style={{ marginTop: 5, fontSize: 12, opacity: 0.68 }}>
                  Higher scores mean greater risk of losing the current pick.
                </div>
              ) : null}

              <div
                style={{
                  marginTop: 16,
                  paddingTop: 14,
                  borderTop: "1px solid rgba(255,255,255,0.09)",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 900,
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                    opacity: 0.62,
                  }}
                >
                  Next game
                </div>

                <div style={{ marginTop: 5, fontWeight: 850 }}>
                  {nextGame.away_team ?? "AWAY"} at{" "}
                  {nextGame.home_team ?? "HOME"}
                </div>

                <div style={{ marginTop: 3, fontSize: 13, opacity: 0.72 }}>
                  {fmtKickoff(nextGame.kickoff_at)}
                </div>

                <div style={{ marginTop: 3, fontSize: 13, opacity: 0.8 }}>
                  {formatSpread(nextGame)}
                </div>
              </div>

              <div
                style={{
                  marginTop: 16,
                  paddingTop: 14,
                  borderTop: "1px solid rgba(255,255,255,0.09)",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 900,
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                    opacity: 0.62,
                    marginBottom: 8,
                  }}
                >
                  {nextGameStarted ? "Most at risk" : "Entries in this game"}
                </div>

                {topSweats.length === 0 ? (
                  <div style={{ opacity: 0.72, fontSize: 13 }}>
                    No active picks yet.
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {(nextGameStarted
                      ? topSweats.slice(0, 3)
                      : topSweats
                    ).map((p, idx) => (
                      <div
                        key={`${p.screen_name}:${idx}`}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 10,
                          fontSize: 13,
                        }}
                      >
                        <div>
                          <strong>
                            {nextGameStarted ? `${idx + 1}. ` : ""}
                            {p.screen_name}
                            {p.isMe ? " (You)" : ""}
                          </strong>
                          <span style={{ opacity: 0.72 }}>
                            {" "}
                            · Pick: {p.pick_team ?? "—"}
                            {p.isAuto ? " · AUTO" : ""}
                          </span>
                        </div>

                        {nextGameStarted ? (
                          <strong>Risk: {p.score}</strong>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ marginTop: 10, opacity: 0.72, fontSize: 13 }}>
              Pool sweat will appear once games and picks are active.
            </div>
          )}
        </section>
      </div>

      <section style={{ marginTop: 22 }}>
        <h2
          style={{
            margin: "0 0 12px",
            fontSize: 20,
            fontWeight: 900,
          }}
        >
          Games
        </h2>

        <div className="sweat-games-grid">
          {games.length === 0 ? (
            <div
              style={{
                padding: 18,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.025)",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 900 }}>
                No picks yet for the current week
              </div>

              <div style={{ marginTop: 6, opacity: 0.74 }}>
                Sweat data and game risk will appear after players submit
                their picks.
              </div>
            </div>
          ) : (
            games.map((g) => {
              const scoreLine =
                typeof g.home_score === "number" &&
                typeof g.away_score === "number"
                  ? `${g.away_team ?? "AWAY"} ${g.away_score} at ${
                      g.home_team ?? "HOME"
                    } ${g.home_score}`
                  : `${g.away_team ?? "AWAY"} at ${
                      g.home_team ?? "HOME"
                    }`;

              const picksSorted = [...g.picks].sort((a, b) => {
                const ra = riskScoreForPick(
                  g,
                  a.pick_team,
                  a.still_alive
                );
                const rb = riskScoreForPick(
                  g,
                  b.pick_team,
                  b.still_alive
                );

                return rb - ra;
              });

              const meaningfulStatus =
                g.status &&
                String(g.status).toLowerCase() !== "scheduled"
                  ? String(g.status)
                  : null;

              return (
                <article
                  key={g.game_id}
                  style={{
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 14,
                    padding: 16,
                    background: "rgba(255,255,255,0.025)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 900 }}>
                        {scoreLine}
                      </div>

                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 13,
                          opacity: 0.7,
                        }}
                      >
                        {fmtKickoff(g.kickoff_at)}
                        {meaningfulStatus
                          ? ` · ${meaningfulStatus}`
                          : ""}
                        {isComplete(g) ? " · Complete" : ""}
                      </div>

                      <div
                        style={{
                          marginTop: 3,
                          fontSize: 13,
                          opacity: 0.8,
                        }}
                      >
                        {formatSpread(g)}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 14,
                      paddingTop: 12,
                      borderTop: "1px solid rgba(255,255,255,0.09)",
                      display: "grid",
                      gap: 12,
                    }}
                  >
                    {picksSorted.map((p) => {
                      const isMe =
                        Boolean(p.user_id) &&
                        Boolean(me.id) &&
                        p.user_id === me.id;

                      const badge = pickResultBadge(
                        p.pick_result,
                        p.still_alive
                      );

                      return (
                        <div
                          key={`${g.game_id}:${
                            p.user_id ?? p.screen_name
                          }:${p.entry_no ?? "entry"}`}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(0, 1fr) auto",
                            alignItems: "center",
                            gap: 12,
                            opacity: p.still_alive ? 1 : 0.58,
                            textDecoration: p.still_alive
                              ? "none"
                              : "line-through",
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 850 }}>
                              {p.screen_name}
                              {isMe ? " (You)" : ""}
                            </div>

                            <div
                              style={{
                                marginTop: 3,
                                fontSize: 13,
                                opacity: 0.72,
                              }}
                            >
                              Pick:{" "}
                              <strong>
                                {p.pick_team ?? "—"}
                                {p.is_auto ? " · AUTO" : ""}
                              </strong>

                              {badge ? (
                                <span style={{ marginLeft: 8 }}>
                                  {badge.text}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {p.still_alive ? (
                            <SweatIntensityMeter
                              status={
                                isComplete(g) ? "final" : g.status
                              }
                              kickoffAt={g.kickoff_at}
                              homeTeam={g.home_team}
                              awayTeam={g.away_team}
                              pickTeam={p.pick_team}
                              homeScore={g.home_score}
                              awayScore={g.away_score}
                            />
                          ) : (
                            <strong style={{ fontSize: 13 }}>
                              ☠️ OUT
                            </strong>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <style>{`
        .sweat-summary-grid {
          display: grid;
          grid-template-columns: minmax(0, 3fr) minmax(300px, 2fr);
          gap: 16px;
        }

        .sweat-games-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        @media (max-width: 850px) {
          .sweat-summary-grid,
          .sweat-games-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
