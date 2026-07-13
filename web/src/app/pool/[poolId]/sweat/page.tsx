import { redirect } from "next/navigation";
import React from "react";
import { createClient } from "@/lib/supabase/server";
import SweatIntensityMeter from "@/app/_components/SweatIntensityMeter";

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
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleString();
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
  const gamesMap = new Map<string, GameGroup>();

  for (const r of list) {
    const gameId = String(r.game_id ?? "");
    if (!gameId) continue;

    const pickTeam = (r.pick_team ?? r.picked_team ?? null) as string | null;
    const status = (r.game_status ?? r.status ?? null) as string | null;

    if (!gamesMap.has(gameId)) {
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

    topSweats = [...scores].sort((a, b) => b.score - a.score).slice(0, 3);
  }

  const poolMeta = riskLabel(poolAvg);

  return (
    <main style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800 }}>Sweat Board</h1>
          <p style={{ marginTop: 6, opacity: 0.75 }}>
            Pool: <strong>{poolId}</strong>
          </p>
        </div>

        <div style={{ opacity: 0.75, fontSize: 13 }}>
          <strong>Intensity legend:</strong> 😌 Chill · 😅 Sweat · 😱 Panic · ✅ Done · ☠️ Out
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 12,
          padding: 14,
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 14, opacity: 0.75 }}>🔥 Pick Popularity</div>
            <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800 }}>
              {popWeek != null ? (
                <>
                  {String(popPhase ?? "").toUpperCase()} · Week {popWeek}
                </>
              ) : (
                <>No week detected yet</>
              )}
            </div>
          </div>

          <div style={{ opacity: 0.75, fontSize: 13 }}>
            {popularityTotal > 0 ? <>{popularityTotal} picks counted</> : <>No picks yet</>}
          </div>
        </div>

        {popularityTotal === 0 ? (
          <div style={{ opacity: 0.75, fontSize: 13 }}>No popularity data available yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {popularity.slice(0, 10).map((r) => {
              const pct = popularityTotal ? Math.round((r.count / popularityTotal) * 100) : 0;

              return (
                <div
                  key={r.team}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "64px 1fr 90px",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontWeight: 900 }}>{r.team}</div>

                  <div
                    style={{
                      height: 10,
                      borderRadius: 999,
                      background: "rgba(0,0,0,0.08)",
                      overflow: "hidden",
                      border: "1px solid rgba(0,0,0,0.10)",
                    }}
                    title={`${r.count} picks (${pct}%)`}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        background: "rgba(255,95,0,0.75)",
                      }}
                    />
                  </div>

                  <div style={{ textAlign: "right", fontSize: 13, opacity: 0.85 }}>
                    <strong>{r.count}</strong> <span style={{ opacity: 0.7 }}>({pct}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {nextGame ? (
        <div
          style={{
            marginTop: 16,
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 12,
            padding: 14,
            display: "grid",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontSize: 14, opacity: 0.75 }}>
                Pool Sweat Intensity (next active game)
              </div>
              <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800 }}>
                {poolMeta.icon} {poolMeta.label}{" "}
                <span style={{ opacity: 0.7, fontWeight: 600 }}>
                  · Avg {poolAvg} / 100 · {poolCount} active picks
                </span>
              </div>
              <div style={{ marginTop: 4, fontSize: 13, opacity: 0.75 }}>
                {nextGame.away_team ?? "AWAY"} @ {nextGame.home_team ?? "HOME"} · Kickoff:{" "}
                {fmtKickoff(nextGame.kickoff_at)}
              </div>
            </div>

            <SweatIntensityMeter
              status={isComplete(nextGame) ? "final" : nextGame.status}
              kickoffAt={nextGame.kickoff_at}
              homeTeam={nextGame.home_team}
              awayTeam={nextGame.away_team}
              pickTeam={null}
              homeScore={nextGame.home_score}
              awayScore={nextGame.away_score}
            />
          </div>

          <div
            style={{
              borderTop: "1px solid rgba(0,0,0,0.08)",
              paddingTop: 10,
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontSize: 13, opacity: 0.75 }}>
              <strong>Top 3 sweats</strong> highest risk among active entries
            </div>

            {topSweats.length === 0 ? (
              <div style={{ opacity: 0.75, fontSize: 13 }}>No active picks yet.</div>
            ) : (
              topSweats.map((p, idx) => {
                const meta = riskLabel(p.score);
                return (
                  <div
                    key={`${p.screen_name}:${idx}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                      fontSize: 13,
                    }}
                  >
                    <div>
                      <strong>
                        {idx + 1}. {p.screen_name}
                        {p.isMe ? " (You)" : ""}
                      </strong>{" "}
                      <span style={{ opacity: 0.8 }}>
                        · Pick:{" "}
                        <strong>
                          {p.pick_team ?? "—"}
                          {p.isAuto ? " · AUTO" : ""}
                        </strong>
                      </span>
                    </div>

                    <div style={{ opacity: 0.85 }}>
                      {meta.icon} {meta.label} · {p.score}/100
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
        {games.length === 0 ? (
          <div
            style={{
              padding: 18,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 900 }}>
              No picks yet for the current week
            </div>
            <div style={{ marginTop: 6, opacity: 0.78 }}>
              Sweat data, pick popularity, and game risk will appear after players submit their picks.
            </div>
          </div>
        ) : (
          games.map((g) => {
            const scoreLine =
              typeof g.home_score === "number" && typeof g.away_score === "number"
                ? `${g.away_team ?? "AWAY"} ${g.away_score} @ ${g.home_team ?? "HOME"} ${g.home_score}`
                : `${g.away_team ?? "AWAY"} @ ${g.home_team ?? "HOME"}`;

            const picksSorted = [...g.picks].sort((a, b) => {
              const ra = riskScoreForPick(g, a.pick_team, a.still_alive);
              const rb = riskScoreForPick(g, b.pick_team, b.still_alive);
              return rb - ra;
            });

            return (
              <div
                key={g.game_id}
                style={{
                  border: "1px solid rgba(0,0,0,0.12)",
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <div style={{ display: "grid", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{scoreLine}</div>
                    <div style={{ marginTop: 4, fontSize: 13, opacity: 0.75 }}>
                      Kickoff: {fmtKickoff(g.kickoff_at)}
                      {g.status ? ` · Status: ${g.status}` : ""}
                      {isComplete(g) ? " · Complete" : ""}
                    </div>
                  </div>

                  <div
                    style={{
                      borderTop: "1px solid rgba(0,0,0,0.08)",
                      paddingTop: 10,
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    {picksSorted.map((p) => {
                      const isMe = p.user_id && me.id && p.user_id === me.id;
                      const badge = pickResultBadge(p.pick_result, p.still_alive);

                      return (
                        <div
                          key={`${g.game_id}:${p.user_id ?? p.screen_name}:${p.entry_no ?? "entry"}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            flexWrap: "wrap",
                            opacity: p.still_alive ? 1 : 0.6,
                            textDecoration: p.still_alive ? "none" : "line-through",
                          }}
                        >
                          <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                            <strong>
                              {p.screen_name}
                              {isMe ? " (You)" : ""}
                            </strong>

                            <span style={{ opacity: 0.8 }}>
                              Pick:{" "}
                              <strong>
                                {p.pick_team ?? "—"}
                                {p.is_auto ? " · AUTO" : ""}
                              </strong>
                            </span>

                            {badge ? (
                              <span
                                title={badge.title}
                                style={{
                                  fontSize: 12,
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  border: "1px solid rgba(0,0,0,0.18)",
                                  opacity: 0.9,
                                }}
                              >
                                {badge.text}
                              </span>
                            ) : null}
                          </div>

                          {p.still_alive ? (
                            <SweatIntensityMeter
                              status={isComplete(g) ? "final" : g.status}
                              kickoffAt={g.kickoff_at}
                              homeTeam={g.home_team}
                              awayTeam={g.away_team}
                              pickTeam={p.pick_team}
                              homeScore={g.home_score}
                              awayScore={g.away_score}
                            />
                          ) : (
                            <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.85 }}>
                              ☠️ OUT
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}