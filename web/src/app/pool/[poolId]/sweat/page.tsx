import { redirect } from "next/navigation";
import React from "react";
import { createClient } from "@/lib/supabase/server";
import SweatIntensityMeter from "@/app/_components/SweatIntensityMeter";

type PickRow = {
  user_id?: string | null;
  screen_name?: string | null;

  game_id?: string | null;
  kickoff_at?: string | null;
  status?: string | null;

  home_team?: string | null;
  away_team?: string | null;
  home_score?: number | null;
  away_score?: number | null;

  pick_team?: string | null;
  picked_team?: string | null;
};

type GameGroup = {
  game_id: string;
  kickoff_at: string | null;
  status: string | null;
  home_team: string | null;
  away_team: string | null;
  home_score: number | null;
  away_score: number | null;

  picks: {
    user_id: string | null;
    screen_name: string;
    pick_team: string | null;
  }[];
};

function fmtKickoff(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleString();
}

function kickoffIsPast(kickoffAt?: string | null) {
  if (!kickoffAt) return false;
  const dt = new Date(kickoffAt);
  if (isNaN(dt.getTime())) return false;
  return Date.now() >= dt.getTime();
}

function isFinalStatus(status?: string | null) {
  const s = String(status ?? "").toLowerCase();
  return (
    s.includes("final") ||
    s.includes("post") || // postgame / postseason-like labels
    s === "finished" ||
    s === "complete" ||
    s === "completed"
  );
}

function haveScores(g: GameGroup) {
  return typeof g.home_score === "number" && typeof g.away_score === "number";
}

// ✅ Stronger completion rule: status says final OR we have scores and kickoff is in the past
function isComplete(g: GameGroup) {
  return isFinalStatus(g.status) || (haveScores(g) && kickoffIsPast(g.kickoff_at));
}

function winnerTeam(g: GameGroup): string | null {
  if (!haveScores(g)) return null;
  const h = g.home_score as number;
  const a = g.away_score as number;
  if (h === a) return null; // tie
  return h > a ? (g.home_team ?? null) : (g.away_team ?? null);
}

// 0..100 “risk score”
function riskScoreForPick(g: GameGroup, pickTeam: string | null) {
  // If complete, no sweat
  if (isComplete(g)) return 0;

  // Pre-game: default moderate “anticipation”
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

  // Tie counts as loss -> Panic
  if (margin <= 0) return 95;
  if (margin <= 7) return 65;
  return 30;
}

function riskLabel(score: number) {
  if (score >= 85) return { icon: "😱", label: "Panic" };
  if (score >= 55) return { icon: "😅", label: "Sweat" };
  return { icon: "😌", label: "Chill" };
}

function pickResult(
  g: GameGroup,
  pickTeam: string | null
): { text: string; title: string } | null {
  // ✅ show result when game is “complete enough”
  if (!isComplete(g)) return null;
  if (!haveScores(g)) return null;

  const win = winnerTeam(g);
  if (!win) {
    // tie => loss per rules
    return { text: "T (L)", title: "Tie game (counts as loss)" };
  }

  if (!pickTeam) return { text: "—", title: "No pick" };

  if (String(pickTeam) === String(win)) return { text: "W", title: "Win" };
  return { text: "L", title: "Loss" };
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

    if (!gamesMap.has(gameId)) {
      gamesMap.set(gameId, {
        game_id: gameId,
        kickoff_at: (r.kickoff_at ?? null) as string | null,
        status: (r.status ?? null) as string | null,
        home_team: (r.home_team ?? null) as string | null,
        away_team: (r.away_team ?? null) as string | null,
        home_score:
          typeof r.home_score === "number" ? (r.home_score as number) : null,
        away_score:
          typeof r.away_score === "number" ? (r.away_score as number) : null,
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
      pick_team: pickTeam,
    });
  }

  const games = Array.from(gamesMap.values());

  // Next relevant game (first not complete, otherwise first game)
  const nextGame = games.find((g) => !isComplete(g)) ?? games[0] ?? null;

  let poolAvg = 0;
  let poolCount = 0;

  let topSweats: {
    score: number;
    screen_name: string;
    pick_team: string | null;
    isMe: boolean;
  }[] = [];

  if (nextGame) {
    const scores = nextGame.picks.map((p) => {
      const score = riskScoreForPick(nextGame, p.pick_team);
      return {
        score,
        screen_name: p.screen_name,
        pick_team: p.pick_team,
        isMe: !!(p.user_id && me.id && p.user_id === me.id),
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
          <strong>Intensity legend:</strong> 😌 Chill · 😅 Sweat · 😱 Panic · ✅ Done
        </div>
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
                Pool Sweat Intensity (next game)
              </div>
              <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800 }}>
                {poolMeta.icon} {poolMeta.label}{" "}
                <span style={{ opacity: 0.7, fontWeight: 600 }}>
                  · Avg {poolAvg} / 100 · {poolCount} picks
                </span>
              </div>
              <div style={{ marginTop: 4, fontSize: 13, opacity: 0.75 }}>
                {nextGame.away_team ?? "AWAY"} @ {nextGame.home_team ?? "HOME"} ·{" "}
                Kickoff: {fmtKickoff(nextGame.kickoff_at)}
              </div>
            </div>

            <SweatIntensityMeter
              status={nextGame.status}
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
              <strong>Top 3 sweats</strong> (highest risk right now)
            </div>

            {topSweats.length === 0 ? (
              <div style={{ opacity: 0.75, fontSize: 13 }}>No picks yet.</div>
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
                        · Pick: <strong>{p.pick_team ?? "—"}</strong>
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
          <div style={{ opacity: 0.75 }}>No games found.</div>
        ) : (
          games.map((g) => {
            const scoreLine =
              typeof g.home_score === "number" && typeof g.away_score === "number"
                ? `${g.away_team ?? "AWAY"} ${g.away_score} @ ${g.home_team ?? "HOME"} ${g.home_score}`
                : `${g.away_team ?? "AWAY"} @ ${g.home_team ?? "HOME"}`;

            const picksSorted = [...g.picks].sort((a, b) => {
              const ra = riskScoreForPick(g, a.pick_team);
              const rb = riskScoreForPick(g, b.pick_team);
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
                      const res = pickResult(g, p.pick_team);

                      return (
                        <div
                          key={`${g.game_id}:${p.user_id ?? p.screen_name}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                            <strong>
                              {p.screen_name}
                              {isMe ? " (You)" : ""}
                            </strong>

                            <span style={{ opacity: 0.8 }}>
                              Pick: <strong>{p.pick_team ?? "—"}</strong>
                            </span>

                            {res ? (
                              <span
                                title={res.title}
                                style={{
                                  fontSize: 12,
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  border: "1px solid rgba(0,0,0,0.18)",
                                  opacity: 0.9,
                                }}
                              >
                                {res.text}
                              </span>
                            ) : null}
                          </div>

                          <SweatIntensityMeter
                            status={isComplete(g) ? "final" : g.status}
                            kickoffAt={g.kickoff_at}
                            homeTeam={g.home_team}
                            awayTeam={g.away_team}
                            pickTeam={p.pick_team}
                            homeScore={g.home_score}
                            awayScore={g.away_score}
                          />
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