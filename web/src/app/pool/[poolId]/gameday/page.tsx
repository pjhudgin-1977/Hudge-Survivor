import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type GameRow = {
  id: string;
  week_number: number | null;
  kickoff_at: string | null;
  away_team: string | null;
  home_team: string | null;
  winner_team: string | null;
  status: string | null;
};

type PickRow = {
  user_id: string;
  entry_no: number | null;
  week_number: number | null;
  phase: string | null;
  picked_team: string | null;
  result: string | null;
  was_autopick: boolean | null;
};

type MemberRow = {
  user_id: string;
  entry_no: number | null;
  screen_name: string | null;
  losses: number | null;
  is_eliminated: boolean | null;
};

type SampleGameRow = {
  week_number: number | null;
  away_team: string | null;
  home_team: string | null;
  kickoff_at: string | null;
};

function fmtKickoff(v: string | null) {
  if (!v) return "TBD";
  try {
    return new Date(v).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "TBD";
  }
}

function getDisplayName(member: MemberRow | null | undefined) {
  if (member?.screen_name && member.screen_name.trim()) {
    return member.screen_name.trim();
  }
  return `Entry ${member?.entry_no ?? "?"}`;
}

function phaseToWeekType(phase: string | null) {
  return String(phase || "").toLowerCase() === "playoffs" ? "POST" : "REG";
}

function weekTypeToPhase(weekType: string | null) {
  return String(weekType || "").toUpperCase() === "POST" ? "playoffs" : "regular";
}

function normalizeGameStatus(status: string | null) {
  const s = String(status || "").trim().toLowerCase();

  if (!s) return "PRE";

  if (
    s === "in" ||
    s === "live" ||
    s === "progress" ||
    s === "in_progress" ||
    s === "in progress" ||
    s === "q1" ||
    s === "q2" ||
    s === "q3" ||
    s === "q4" ||
    s === "ot"
  ) {
    return "LIVE";
  }

  if (s === "half" || s === "halftime") {
    return "HALF";
  }

  if (
    s === "final" ||
    s === "complete" ||
    s === "completed" ||
    s === "post" ||
    s === "closed"
  ) {
    return "FINAL";
  }

  if (s === "pre" || s === "scheduled" || s === "upcoming") {
    return "PRE";
  }

  return String(status || "").toUpperCase();
}

function getStatusPillStyle(displayStatus: string) {
  if (displayStatus === "LIVE") {
    return {
      background: "rgba(34,197,94,0.18)",
      border: "1px solid rgba(34,197,94,0.38)",
      color: "inherit",
    };
  }

  if (displayStatus === "HALF") {
    return {
      background: "rgba(245,158,11,0.18)",
      border: "1px solid rgba(245,158,11,0.38)",
      color: "inherit",
    };
  }

  if (displayStatus === "FINAL") {
    return {
      background: "rgba(148,163,184,0.16)",
      border: "1px solid rgba(148,163,184,0.34)",
      color: "inherit",
    };
  }

  return {
    background: "rgba(59,130,246,0.14)",
    border: "1px solid rgba(59,130,246,0.30)",
    color: "inherit",
  };
}

function getTeamPanelStyle(
  team: string,
  winnerTeam: string | null,
  displayStatus: string
) {
  const winner = String(winnerTeam || "").trim();
  const isDecided = displayStatus === "LIVE" || displayStatus === "HALF" || displayStatus === "FINAL";

  if (!winner || !isDecided) {
    return {
      border: "1px solid rgba(255,255,255,0.08)",
      background: "transparent",
    };
  }

  if (team === winner) {
    return {
      border: "1px solid rgba(34,197,94,0.34)",
      background: "rgba(34,197,94,0.10)",
    };
  }

  return {
    border: "1px solid rgba(239,68,68,0.24)",
    background: "rgba(239,68,68,0.07)",
  };
}

function getTeamLabelStyle(
  team: string,
  winnerTeam: string | null,
  displayStatus: string
) {
  const winner = String(winnerTeam || "").trim();
  const isDecided = displayStatus === "LIVE" || displayStatus === "HALF" || displayStatus === "FINAL";

  if (!winner || !isDecided) {
    return {
      color: "inherit",
    };
  }

  if (team === winner) {
    return {
      color: "#86efac",
    };
  }

  return {
    color: "#fca5a5",
  };
}

function getResultBadge(
  team: string,
  winnerTeam: string | null,
  displayStatus: string
) {
  const winner = String(winnerTeam || "").trim();
  const isDecided = displayStatus === "LIVE" || displayStatus === "HALF" || displayStatus === "FINAL";

  if (!winner || !isDecided) return null;

  if (team === winner) {
    return "WINNING";
  }

  return "LOSING";
}

export default async function GameDayPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const { poolId } = await params;
  const supabase = await createClient();

  const { data: nextGame } = await supabase
    .from("games")
    .select("week_number, kickoff_at")
    .gte("kickoff_at", new Date().toISOString())
    .order("kickoff_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: sampleGames } = await supabase
    .from("games")
    .select("week_number, away_team, home_team, kickoff_at")
    .order("kickoff_at", { ascending: true })
    .limit(12);

  let currentWeekNumber = nextGame?.week_number ?? null;
  let currentWeekType: string | null = null;

  if (currentWeekNumber == null) {
    const { data: latestGame } = await supabase
      .from("games")
      .select("week_number, kickoff_at")
      .order("kickoff_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    currentWeekNumber = latestGame?.week_number ?? null;
  }

  let displayWeekNumber = currentWeekNumber;
  let displayWeekType: string | null = currentWeekType;
  let gamesData: GameRow[] | null = null;
  let displayPhase = weekTypeToPhase(displayWeekType);

  const initialGamesRes = await supabase
    .from("games")
    .select("id, week_number, kickoff_at, away_team, home_team, winner_team, status")
    .eq("week_number", displayWeekNumber ?? -1)
    .order("kickoff_at", { ascending: true });

  gamesData = (initialGamesRes.data as GameRow[] | null) ?? [];

  let { data: picksData } = await supabase
    .from("picks")
    .select("user_id, entry_no, week_number, phase, picked_team, result, was_autopick")
    .eq("pool_id", poolId)
    .eq("week_number", displayWeekNumber ?? -1)
    .eq("phase", displayPhase);

  const noCurrentGames = !Array.isArray(gamesData) || gamesData.length === 0;
  const noCurrentPicks = !Array.isArray(picksData) || picksData.length === 0;

  if (noCurrentGames || noCurrentPicks) {
    const { data: latestPoolPick } = await supabase
      .from("picks")
      .select("week_number, phase")
      .eq("pool_id", poolId)
      .not("picked_team", "is", null)
      .order("week_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestPoolPick?.week_number != null) {
      displayWeekNumber = latestPoolPick.week_number;
      displayPhase = String(latestPoolPick.phase || "regular").toLowerCase();
      displayWeekType = phaseToWeekType(displayPhase);

      const gamesRes = await supabase
        .from("games")
        .select("id, week_number, kickoff_at, away_team, home_team, winner_team, status")
        .eq("week_number", displayWeekNumber)
        .order("kickoff_at", { ascending: true });

      gamesData = (gamesRes.data as GameRow[] | null) ?? [];

      const picksRes = await supabase
        .from("picks")
        .select("user_id, entry_no, week_number, phase, picked_team, result, was_autopick")
        .eq("pool_id", poolId)
        .eq("week_number", displayWeekNumber)
        .eq("phase", displayPhase);

      picksData = picksRes.data ?? [];
    }
  }

  const { data: membersData } = await supabase
    .from("pool_members")
    .select("user_id, entry_no, screen_name, losses, is_eliminated")
    .eq("pool_id", poolId)
    .order("entry_no", { ascending: true });

  const typedGames: GameRow[] = Array.isArray(gamesData) ? gamesData : [];
  const typedPicks: PickRow[] = Array.isArray(picksData) ? picksData : [];
  const typedMembers: MemberRow[] = Array.isArray(membersData) ? membersData : [];
  const typedSampleGames: SampleGameRow[] = Array.isArray(sampleGames) ? sampleGames : [];

  const memberMap = new Map(
    typedMembers.map((m) => [`${m.user_id}:${m.entry_no ?? 1}`, m])
  );

  const pickedCountByTeam = new Map<string, number>();
  for (const p of typedPicks) {
    const team = (p.picked_team || "").trim();
    if (!team) continue;
    pickedCountByTeam.set(team, (pickedCountByTeam.get(team) ?? 0) + 1);
  }

  let mostPickedTeam = "—";
  let mostPickedCount = 0;
  for (const [team, count] of pickedCountByTeam.entries()) {
    if (count > mostPickedCount) {
      mostPickedTeam = team;
      mostPickedCount = count;
    }
  }

  const livePicks = typedPicks.filter(
    (p) => (p.result || "").toLowerCase() === "pending" || !p.result
  ).length;

  const dangerEntries = typedMembers.filter((m) => {
    const losses = Number(m.losses ?? 0);
    return !m.is_eliminated && losses >= 1;
  });

  const gameCards = typedGames
    .map((game) => {
      const away = game.away_team || "AWAY";
      const home = game.home_team || "HOME";

      const entriesOnAway = typedPicks.filter(
        (p) => (p.picked_team || "").trim() === away
      );

      const entriesOnHome = typedPicks.filter(
        (p) => (p.picked_team || "").trim() === home
      );

      const allEntries = [...entriesOnAway, ...entriesOnHome];
      const totalOnGame = allEntries.length;

      const dangerCount = allEntries.filter((p) => {
        const key = `${p.user_id}:${p.entry_no ?? 1}`;
        const member = memberMap.get(key);
        return !member?.is_eliminated && Number(member?.losses ?? 0) >= 1;
      }).length;

      const isPopular = totalOnGame >= 3;
      const isSweat = totalOnGame >= 1;
      const hasDanger = dangerCount > 0;
      const kickoffTs = game.kickoff_at ? new Date(game.kickoff_at).getTime() : 0;
      const displayStatus = normalizeGameStatus(game.status);

      return {
        game,
        away,
        home,
        entriesOnAway,
        entriesOnHome,
        totalOnGame,
        dangerCount,
        isPopular,
        isSweat,
        hasDanger,
        kickoffTs,
        displayStatus,
      };
    })
    .sort((a, b) => {
      if (a.totalOnGame > 0 && b.totalOnGame === 0) return -1;
      if (a.totalOnGame === 0 && b.totalOnGame > 0) return 1;

      if (a.hasDanger && !b.hasDanger) return -1;
      if (!a.hasDanger && b.hasDanger) return 1;

      if (b.totalOnGame !== a.totalOnGame) return b.totalOnGame - a.totalOnGame;

      return a.kickoffTs - b.kickoffTs;
    });

  const activeGames = gameCards.filter((g) => g.totalOnGame > 0).length;
  const topSweatGames = gameCards.filter((g) => g.totalOnGame > 0).slice(0, 3);
  const usingFallbackWeek =
    displayWeekNumber !== currentWeekNumber || displayWeekType !== currentWeekType;

  return (
    <main style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ fontSize: 34, fontWeight: 900, margin: 0 }}>Game Day</h1>
          <p style={{ opacity: 0.82, marginTop: 8 }}>
            Sunday sweat board for the current week.
          </p>
          <p style={{ opacity: 0.62, marginTop: 6, fontSize: 14 }}>
            Week {displayWeekNumber ?? "—"} ·{" "}
            {String(displayWeekType || "REG").toUpperCase() === "POST"
              ? "Playoffs"
              : "Regular Season"}
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link
            href={`/pool/${poolId}/sweat`}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.14)",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            🔥 Sweat Games
          </Link>

          <Link
            href={`/pool/${poolId}/danger`}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.14)",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            ⚠️ Danger Zone
          </Link>
        </div>
      </div>

      {usingFallbackWeek ? (
        <div
          style={{
            marginTop: 16,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,215,0,0.24)",
            background: "rgba(255,215,0,0.08)",
            fontSize: 14,
            opacity: 0.92,
          }}
        >
          Showing the most recent week with pool picks for testing.
        </div>
      ) : null}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 16,
          marginTop: 24,
        }}
      >
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 16,
            padding: 18,
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <div style={{ opacity: 0.7, fontSize: 13 }}>Live Picks</div>
          <div style={{ fontSize: 34, fontWeight: 900, marginTop: 8 }}>
            {livePicks}
          </div>
        </div>

        <div
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 16,
            padding: 18,
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <div style={{ opacity: 0.7, fontSize: 13 }}>Danger Entries</div>
          <div style={{ fontSize: 34, fontWeight: 900, marginTop: 8 }}>
            {dangerEntries.length}
          </div>
        </div>

        <div
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 16,
            padding: 18,
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <div style={{ opacity: 0.7, fontSize: 13 }}>Most Picked Team</div>
          <div style={{ fontSize: 28, fontWeight: 900, marginTop: 8 }}>
            {mostPickedTeam}
          </div>
          <div style={{ opacity: 0.7, marginTop: 4 }}>
            {mostPickedCount} pick{mostPickedCount === 1 ? "" : "s"}
          </div>
        </div>

        <div
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 16,
            padding: 18,
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <div style={{ opacity: 0.7, fontSize: 13 }}>Active Games</div>
          <div style={{ fontSize: 34, fontWeight: 900, marginTop: 8 }}>
            {activeGames}
          </div>
        </div>
      </section>

      <section
        style={{
          marginTop: 20,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 18,
          padding: 18,
          background:
            "linear-gradient(180deg, rgba(11,34,68,0.55) 0%, rgba(255,255,255,0.02) 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
            Top Sweat Games
          </h2>
          <div style={{ opacity: 0.68, fontSize: 14 }}>
            Biggest games at the top
          </div>
        </div>

        {topSweatGames.length === 0 ? (
          <div style={{ marginTop: 14, opacity: 0.75 }}>
            No live sweat games yet this week.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 14,
              marginTop: 16,
            }}
          >
            {topSweatGames.map((card) => {
              const awayBadge = getResultBadge(
                card.away,
                card.game.winner_team,
                card.displayStatus
              );
              const homeBadge = getResultBadge(
                card.home,
                card.game.winner_team,
                card.displayStatus
              );

              return (
                <div
                  key={`top-${card.game.id}`}
                  style={{
                    border: "1px solid rgba(255,255,255,0.14)",
                    borderRadius: 16,
                    padding: 16,
                    background: "rgba(255,255,255,0.04)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ fontSize: 22, fontWeight: 900 }}>
                      {card.away} @ {card.home}
                    </div>

                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 900,
                        padding: "6px 10px",
                        borderRadius: 999,
                        letterSpacing: 0.3,
                        ...getStatusPillStyle(card.displayStatus),
                      }}
                    >
                      {card.displayStatus}
                    </span>
                  </div>

                  <div style={{ opacity: 0.68, marginTop: 6 }}>
                    {fmtKickoff(card.game.kickoff_at)}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      marginTop: 12,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        padding: "6px 10px",
                        borderRadius: 999,
                        background: "rgba(255,120,0,0.18)",
                        border: "1px solid rgba(255,120,0,0.35)",
                      }}
                    >
                      {card.totalOnGame} PICK{card.totalOnGame === 1 ? "" : "S"}
                    </span>

                    {card.dangerCount > 0 ? (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          padding: "6px 10px",
                          borderRadius: 999,
                          background: "rgba(255,215,0,0.16)",
                          border: "1px solid rgba(255,215,0,0.32)",
                        }}
                      >
                        {card.dangerCount} DANGER
                      </span>
                    ) : null}

                    {card.isPopular ? (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          padding: "6px 10px",
                          borderRadius: 999,
                          background: "rgba(30,144,255,0.16)",
                          border: "1px solid rgba(30,144,255,0.32)",
                        }}
                      >
                        POPULAR
                      </span>
                    ) : null}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                      marginTop: 14,
                    }}
                  >
                    <div
                      style={{
                        borderRadius: 12,
                        padding: 12,
                        ...getTeamPanelStyle(
                          card.away,
                          card.game.winner_team,
                          card.displayStatus
                        ),
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 900,
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 8,
                          alignItems: "center",
                          ...getTeamLabelStyle(
                            card.away,
                            card.game.winner_team,
                            card.displayStatus
                          ),
                        }}
                      >
                        <span>{card.away}</span>
                        {awayBadge ? (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 900,
                              padding: "4px 8px",
                              borderRadius: 999,
                              background:
                                awayBadge === "WINNING"
                                  ? "rgba(34,197,94,0.18)"
                                  : "rgba(239,68,68,0.16)",
                              border:
                                awayBadge === "WINNING"
                                  ? "1px solid rgba(34,197,94,0.36)"
                                  : "1px solid rgba(239,68,68,0.30)",
                              color: "inherit",
                            }}
                          >
                            {awayBadge}
                          </span>
                        ) : null}
                      </div>

                      <div style={{ opacity: 0.68, marginTop: 4 }}>
                        {card.entriesOnAway.length} pick
                        {card.entriesOnAway.length === 1 ? "" : "s"}
                      </div>

                      <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
                        {card.entriesOnAway.length === 0 ? (
                          <div style={{ opacity: 0.55 }}>No entries</div>
                        ) : (
                          <>
                            {card.entriesOnAway.slice(0, 4).map((p, i) => {
                              const m = memberMap.get(`${p.user_id}:${p.entry_no ?? 1}`);
                              return (
                                <div key={`top-away-${card.game.id}-${i}`}>
                                  {getDisplayName(m)}
                                </div>
                              );
                            })}
                            {card.entriesOnAway.length > 4 ? (
                              <div style={{ opacity: 0.6 }}>
                                +{card.entriesOnAway.length - 4} more
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        borderRadius: 12,
                        padding: 12,
                        ...getTeamPanelStyle(
                          card.home,
                          card.game.winner_team,
                          card.displayStatus
                        ),
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 900,
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 8,
                          alignItems: "center",
                          ...getTeamLabelStyle(
                            card.home,
                            card.game.winner_team,
                            card.displayStatus
                          ),
                        }}
                      >
                        <span>{card.home}</span>
                        {homeBadge ? (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 900,
                              padding: "4px 8px",
                              borderRadius: 999,
                              background:
                                homeBadge === "WINNING"
                                  ? "rgba(34,197,94,0.18)"
                                  : "rgba(239,68,68,0.16)",
                              border:
                                homeBadge === "WINNING"
                                  ? "1px solid rgba(34,197,94,0.36)"
                                  : "1px solid rgba(239,68,68,0.30)",
                              color: "inherit",
                            }}
                          >
                            {homeBadge}
                          </span>
                        ) : null}
                      </div>

                      <div style={{ opacity: 0.68, marginTop: 4 }}>
                        {card.entriesOnHome.length} pick
                        {card.entriesOnHome.length === 1 ? "" : "s"}
                      </div>

                      <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
                        {card.entriesOnHome.length === 0 ? (
                          <div style={{ opacity: 0.55 }}>No entries</div>
                        ) : (
                          <>
                            {card.entriesOnHome.slice(0, 4).map((p, i) => {
                              const m = memberMap.get(`${p.user_id}:${p.entry_no ?? 1}`);
                              return (
                                <div key={`top-home-${card.game.id}-${i}`}>
                                  {getDisplayName(m)}
                                </div>
                              );
                            })}
                            {card.entriesOnHome.length > 4 ? (
                              <div style={{ opacity: 0.6 }}>
                                +{card.entriesOnHome.length - 4} more
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.7fr) minmax(320px, 0.9fr)",
          gap: 20,
          marginTop: 24,
          alignItems: "start",
        }}
      >
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 18,
            padding: 18,
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
            Current Week Games
          </h2>

          <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
            {gameCards.length === 0 ? (
              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 14,
                  padding: 18,
                  opacity: 0.9,
                  fontSize: 14,
                  lineHeight: 1.6,
                }}
              >
                <div>No games found for this view.</div>
                <div style={{ marginTop: 10 }}>
                  displayWeekNumber: {String(displayWeekNumber)}
                </div>
                <div>displayWeekType: {String(displayWeekType)}</div>
                <div>displayPhase: {String(displayPhase)}</div>
                <div>typedGames: {typedGames.length}</div>
                <div>typedPicks: {typedPicks.length}</div>
                <div>currentWeekNumber: {String(currentWeekNumber)}</div>
                <div>currentWeekType: {String(currentWeekType)}</div>
                <div style={{ marginTop: 10, fontWeight: 800 }}>sampleGames:</div>
                {typedSampleGames.map((g, i) => (
                  <div key={i}>
                    {String(g.week_number)} | {String(g.away_team)} @{" "}
                    {String(g.home_team)} | {fmtKickoff(g.kickoff_at)}
                  </div>
                ))}
              </div>
            ) : (
              gameCards.map((card) => {
                const awayBadge = getResultBadge(
                  card.away,
                  card.game.winner_team,
                  card.displayStatus
                );
                const homeBadge = getResultBadge(
                  card.home,
                  card.game.winner_team,
                  card.displayStatus
                );

                return (
                  <div
                    key={card.game.id}
                    style={{
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 16,
                      padding: 16,
                      background:
                        card.totalOnGame > 0
                          ? "rgba(255,255,255,0.04)"
                          : "rgba(255,255,255,0.015)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 24, fontWeight: 900 }}>
                          {card.away} @ {card.home}
                        </div>
                        <div style={{ opacity: 0.68, marginTop: 4 }}>
                          {fmtKickoff(card.game.kickoff_at)}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 900,
                            padding: "6px 10px",
                            borderRadius: 999,
                            letterSpacing: 0.3,
                            ...getStatusPillStyle(card.displayStatus),
                          }}
                        >
                          {card.displayStatus}
                        </span>

                        {card.isSweat ? (
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 800,
                              padding: "6px 10px",
                              borderRadius: 999,
                              background: "rgba(255,120,0,0.18)",
                              border: "1px solid rgba(255,120,0,0.35)",
                            }}
                          >
                            SWEAT
                          </span>
                        ) : null}

                        {card.hasDanger ? (
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 800,
                              padding: "6px 10px",
                              borderRadius: 999,
                              background: "rgba(255,215,0,0.16)",
                              border: "1px solid rgba(255,215,0,0.32)",
                            }}
                          >
                            DANGER
                          </span>
                        ) : null}

                        {card.isPopular ? (
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 800,
                              padding: "6px 10px",
                              borderRadius: 999,
                              background: "rgba(30,144,255,0.16)",
                              border: "1px solid rgba(30,144,255,0.32)",
                            }}
                          >
                            POPULAR
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 14,
                        marginTop: 16,
                      }}
                    >
                      <div
                        style={{
                          borderRadius: 14,
                          padding: 14,
                          ...getTeamPanelStyle(
                            card.away,
                            card.game.winner_team,
                            card.displayStatus
                          ),
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 900,
                            fontSize: 18,
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 8,
                            alignItems: "center",
                            ...getTeamLabelStyle(
                              card.away,
                              card.game.winner_team,
                              card.displayStatus
                            ),
                          }}
                        >
                          <span>{card.away}</span>
                          {awayBadge ? (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 900,
                                padding: "4px 8px",
                                borderRadius: 999,
                                background:
                                  awayBadge === "WINNING"
                                    ? "rgba(34,197,94,0.18)"
                                    : "rgba(239,68,68,0.16)",
                                border:
                                  awayBadge === "WINNING"
                                    ? "1px solid rgba(34,197,94,0.36)"
                                    : "1px solid rgba(239,68,68,0.30)",
                                color: "inherit",
                              }}
                            >
                              {awayBadge}
                            </span>
                          ) : null}
                        </div>
                        <div style={{ opacity: 0.65, marginTop: 4 }}>
                          {card.entriesOnAway.length} pick
                          {card.entriesOnAway.length === 1 ? "" : "s"}
                        </div>

                        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                          {card.entriesOnAway.length === 0 ? (
                            <div style={{ opacity: 0.5, fontSize: 14 }}>
                              No entries
                            </div>
                          ) : (
                            card.entriesOnAway.map((pick, idx) => {
                              const member =
                                memberMap.get(
                                  `${pick.user_id}:${pick.entry_no ?? 1}`
                                ) || null;

                              const isDanger =
                                !member?.is_eliminated &&
                                Number(member?.losses ?? 0) >= 1;

                              return (
                                <div
                                  key={`${card.game.id}-away-${pick.user_id}-${pick.entry_no ?? 1}-${idx}`}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: 10,
                                    alignItems: "center",
                                    padding: "8px 10px",
                                    borderRadius: 10,
                                    background: "rgba(255,255,255,0.04)",
                                  }}
                                >
                                  <div style={{ fontWeight: 700 }}>
                                    {getDisplayName(
                                      member || {
                                        user_id: pick.user_id,
                                        entry_no: pick.entry_no,
                                        screen_name: null,
                                        losses: 0,
                                        is_eliminated: false,
                                      }
                                    )}
                                  </div>

                                  <div style={{ display: "flex", gap: 6 }}>
                                    {pick.was_autopick ? (
                                      <span
                                        style={{
                                          fontSize: 11,
                                          fontWeight: 800,
                                          padding: "4px 8px",
                                          borderRadius: 999,
                                          border:
                                            "1px solid rgba(255,255,255,0.16)",
                                        }}
                                      >
                                        AUTO
                                      </span>
                                    ) : null}

                                    {isDanger ? (
                                      <span
                                        style={{
                                          fontSize: 11,
                                          fontWeight: 800,
                                          padding: "4px 8px",
                                          borderRadius: 999,
                                          background: "rgba(255,215,0,0.14)",
                                          border:
                                            "1px solid rgba(255,215,0,0.26)",
                                        }}
                                      >
                                        LAST LIFE
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          borderRadius: 14,
                          padding: 14,
                          ...getTeamPanelStyle(
                            card.home,
                            card.game.winner_team,
                            card.displayStatus
                          ),
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 900,
                            fontSize: 18,
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 8,
                            alignItems: "center",
                            ...getTeamLabelStyle(
                              card.home,
                              card.game.winner_team,
                              card.displayStatus
                            ),
                          }}
                        >
                          <span>{card.home}</span>
                          {homeBadge ? (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 900,
                                padding: "4px 8px",
                                borderRadius: 999,
                                background:
                                  homeBadge === "WINNING"
                                    ? "rgba(34,197,94,0.18)"
                                    : "rgba(239,68,68,0.16)",
                                border:
                                  homeBadge === "WINNING"
                                    ? "1px solid rgba(34,197,94,0.36)"
                                    : "1px solid rgba(239,68,68,0.30)",
                                color: "inherit",
                              }}
                            >
                              {homeBadge}
                            </span>
                          ) : null}
                        </div>
                        <div style={{ opacity: 0.65, marginTop: 4 }}>
                          {card.entriesOnHome.length} pick
                          {card.entriesOnHome.length === 1 ? "" : "s"}
                        </div>

                        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                          {card.entriesOnHome.length === 0 ? (
                            <div style={{ opacity: 0.5, fontSize: 14 }}>
                              No entries
                            </div>
                          ) : (
                            card.entriesOnHome.map((pick, idx) => {
                              const member =
                                memberMap.get(
                                  `${pick.user_id}:${pick.entry_no ?? 1}`
                                ) || null;

                              const isDanger =
                                !member?.is_eliminated &&
                                Number(member?.losses ?? 0) >= 1;

                              return (
                                <div
                                  key={`${card.game.id}-home-${pick.user_id}-${pick.entry_no ?? 1}-${idx}`}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: 10,
                                    alignItems: "center",
                                    padding: "8px 10px",
                                    borderRadius: 10,
                                    background: "rgba(255,255,255,0.04)",
                                  }}
                                >
                                  <div style={{ fontWeight: 700 }}>
                                    {getDisplayName(
                                      member || {
                                        user_id: pick.user_id,
                                        entry_no: pick.entry_no,
                                        screen_name: null,
                                        losses: 0,
                                        is_eliminated: false,
                                      }
                                    )}
                                  </div>

                                  <div style={{ display: "flex", gap: 6 }}>
                                    {pick.was_autopick ? (
                                      <span
                                        style={{
                                          fontSize: 11,
                                          fontWeight: 800,
                                          padding: "4px 8px",
                                          borderRadius: 999,
                                          border:
                                            "1px solid rgba(255,255,255,0.16)",
                                        }}
                                      >
                                        AUTO
                                      </span>
                                    ) : null}

                                    {isDanger ? (
                                      <span
                                        style={{
                                          fontSize: 11,
                                          fontWeight: 800,
                                          padding: "4px 8px",
                                          borderRadius: 999,
                                          background: "rgba(255,215,0,0.14)",
                                          border:
                                            "1px solid rgba(255,215,0,0.26)",
                                        }}
                                      >
                                        LAST LIFE
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <aside
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 18,
            padding: 18,
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
            Danger Zone
          </h2>

          <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
            {dangerEntries.length === 0 ? (
              <div style={{ opacity: 0.7 }}>No danger entries this week.</div>
            ) : (
              dangerEntries.map((member) => {
                const pick = typedPicks.find(
                  (p) =>
                    p.user_id === member.user_id &&
                    (p.entry_no ?? 1) === (member.entry_no ?? 1)
                );

                return (
                  <div
                    key={`${member.user_id}:${member.entry_no ?? 1}`}
                    style={{
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 14,
                      padding: 12,
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>
                      {getDisplayName(member)}
                    </div>
                    <div style={{ opacity: 0.72, marginTop: 4, fontSize: 14 }}>
                      Pick: {pick?.picked_team || "—"}
                    </div>
                    <div style={{ opacity: 0.72, marginTop: 2, fontSize: 14 }}>
                      Status: {(pick?.result || "pending").toUpperCase()}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}