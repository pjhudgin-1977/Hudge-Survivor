import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type PickRow = {
  user_id: string;
  entry_no: number | null;
  picked_team: string | null;
  was_autopick: boolean | null;
  screen_name: string | null;
  losses: number | null;
  is_eliminated: boolean | null;
};

type GameRow = {
  id: string;
  kickoff_at: string | null;
  away_team: string | null;
  home_team: string | null;
  away_score: number | null;
  home_score: number | null;
  status: string | null;
  week_number: number | null;
};

function normalizeTeam(team: string | null | undefined) {
  return String(team || "").trim().toUpperCase();
}

function statusLabel(status: string | null | undefined) {
  const s = String(status || "").toUpperCase();

  if (s.includes("FINAL")) return "FINAL";
  if (s.includes("HALF")) return "HALF";
  if (
    s.includes("IN_PROGRESS") ||
    s.includes("LIVE") ||
    s.includes("Q1") ||
    s.includes("Q2") ||
    s.includes("Q3") ||
    s.includes("Q4") ||
    s.includes("OT")
  ) {
    return "LIVE";
  }
  return "PRE";
}

function getTeamResult(game: GameRow, team: string) {
  const t = normalizeTeam(team);
  const away = normalizeTeam(game.away_team);
  const home = normalizeTeam(game.home_team);

  if (!t || (t !== away && t !== home)) return null;

  const awayScore = Number(game.away_score ?? 0);
  const homeScore = Number(game.home_score ?? 0);
  const isFinalish = ["LIVE", "HALF", "FINAL"].includes(statusLabel(game.status));

  if (!isFinalish) return null;
  if (awayScore === homeScore) return "TIED";

  const teamWon =
    (t === away && awayScore > homeScore) || (t === home && homeScore > awayScore);

  return teamWon ? "WINNING" : "LOSING";
}

function formatName(p: PickRow) {
  const base = String(p.screen_name || "Player").trim() || "Player";
  const entryNo = Number(p.entry_no || 1);
  return entryNo > 1 ? `${base} #${entryNo}` : base;
}

function AutoPickBadge() {
  return (
    <span
      style={{
        display: "inline-block",
        marginLeft: 6,
        padding: "2px 7px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
        background: "rgba(245,158,11,0.18)",
        color: "#fbbf24",
        border: "1px solid rgba(251,191,36,0.35)",
        verticalAlign: "middle",
      }}
    >
      AUTO
    </span>
  );
}

function LastLifeBadge() {
  return (
    <span
      style={{
        display: "inline-block",
        marginLeft: 6,
        padding: "2px 7px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
        background: "rgba(239,68,68,0.16)",
        color: "#fca5a5",
        border: "1px solid rgba(248,113,113,0.35)",
        verticalAlign: "middle",
      }}
    >
      LAST LIFE
    </span>
  );
}

function GameStatusPill({ status }: { status: string | null }) {
  const label = statusLabel(status);

  const styles =
    label === "FINAL"
      ? {
          background: "rgba(148,163,184,0.16)",
          color: "#cbd5e1",
          border: "1px solid rgba(203,213,225,0.20)",
        }
      : label === "HALF"
      ? {
          background: "rgba(245,158,11,0.18)",
          color: "#fbbf24",
          border: "1px solid rgba(251,191,36,0.30)",
        }
      : label === "LIVE"
      ? {
          background: "rgba(239,68,68,0.16)",
          color: "#fca5a5",
          border: "1px solid rgba(248,113,113,0.30)",
        }
      : {
          background: "rgba(59,130,246,0.16)",
          color: "#93c5fd",
          border: "1px solid rgba(147,197,253,0.28)",
        };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 52,
        padding: "5px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 900,
        letterSpacing: 0.4,
        ...styles,
      }}
    >
      {label}
    </span>
  );
}

function ResultBadge({ result }: { result: "WINNING" | "LOSING" | "TIED" | null }) {
  if (!result || result === "TIED") return null;

  const styles =
    result === "WINNING"
      ? {
          background: "rgba(34,197,94,0.16)",
          color: "#86efac",
          border: "1px solid rgba(134,239,172,0.28)",
        }
      : {
          background: "rgba(239,68,68,0.16)",
          color: "#fca5a5",
          border: "1px solid rgba(248,113,113,0.28)",
        };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4px 8px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: 0.4,
        ...styles,
      }}
    >
      {result}
    </span>
  );
}

function TeamPanel({
  team,
  score,
  picks,
  game,
}: {
  team: string | null;
  score: number | null;
  picks: PickRow[];
  game: GameRow;
}) {
  const teamCode = normalizeTeam(team);
  const result = getTeamResult(game, teamCode);

  const panelStyle =
    result === "WINNING"
      ? {
          background: "rgba(34,197,94,0.12)",
          border: "1px solid rgba(134,239,172,0.28)",
        }
      : result === "LOSING"
      ? {
          background: "rgba(239,68,68,0.12)",
          border: "1px solid rgba(248,113,113,0.24)",
        }
      : {
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.10)",
        };

  return (
    <div
      style={{
        borderRadius: 16,
        padding: 14,
        minHeight: 150,
        ...panelStyle,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 900 }}>{teamCode || "—"}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ResultBadge result={result} />
          <div style={{ fontSize: 22, fontWeight: 900 }}>{score ?? "—"}</div>
        </div>
      </div>

      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
        {picks.length} pick{picks.length === 1 ? "" : "s"}
      </div>

      {picks.length === 0 ? (
        <div style={{ fontSize: 13, opacity: 0.45 }}>No picks</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {picks.map((p, idx) => (
            <div
              key={`${p.user_id}-${p.entry_no}-${idx}`}
              style={{
                fontSize: 13,
                fontWeight: 700,
                lineHeight: 1.35,
              }}
            >
              {formatName(p)}
              {p.was_autopick ? <AutoPickBadge /> : null}
              {Number(p.losses || 0) >= 1 && !p.is_eliminated ? <LastLifeBadge /> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


export default async function GameDayPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const { poolId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/pool/${poolId}/gameday`);
  }

  const { data: latestPoolPick } = await supabase
    .from("picks")
    .select("week_number")
    .eq("pool_id", poolId)
    .order("week_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  let displayWeekNumber = Number(latestPoolPick?.week_number || 1);

  let { data: weekPicks } = await supabase
    .from("picks")
    .select(
      `
      user_id,
      entry_no,
      picked_team,
      was_autopick,
      pool_members!inner (
        screen_name,
        losses,
        is_eliminated
      )
    `
    )
    .eq("pool_id", poolId)
    .eq("week_number", displayWeekNumber);

  if (!weekPicks || weekPicks.length === 0) {
    const { data: allPickWeeks } = await supabase
      .from("picks")
      .select("week_number")
      .eq("pool_id", poolId)
      .order("week_number", { ascending: false });

    const fallbackWeek = allPickWeeks?.find((r) => Number(r.week_number) > 0)?.week_number;

    if (fallbackWeek) {
      displayWeekNumber = Number(fallbackWeek);

      const res = await supabase
        .from("picks")
        .select(
          `
          user_id,
          entry_no,
          picked_team,
          was_autopick,
          pool_members!inner (
            screen_name,
            losses,
            is_eliminated
          )
        `
        )
        .eq("pool_id", poolId)
        .eq("week_number", displayWeekNumber);

      weekPicks = res.data || [];
    }
  }

  const mappedPicks: PickRow[] = (weekPicks || []).map((p: any) => {
    const member = Array.isArray(p.pool_members) ? p.pool_members[0] : p.pool_members;
    return {
      user_id: p.user_id,
      entry_no: p.entry_no ?? 1,
      picked_team: p.picked_team,
      was_autopick: p.was_autopick,
      screen_name: member?.screen_name ?? null,
      losses: member?.losses ?? 0,
      is_eliminated: member?.is_eliminated ?? false,
    };
  });

  const { data: gamesData } = await supabase
    .from("games")
    .select(
      "id, kickoff_at, away_team, home_team, away_score, home_score, status, week_number"
    )
    .eq("week_number", displayWeekNumber)
    .order("kickoff_at", { ascending: true });

  const games: GameRow[] = gamesData || [];

  const picksByTeam = new Map<string, PickRow[]>();
  for (const p of mappedPicks) {
    const key = normalizeTeam(p.picked_team);
    if (!key) continue;
    if (!picksByTeam.has(key)) picksByTeam.set(key, []);
    picksByTeam.get(key)!.push(p);
  }

  const gamesWithMeta = games.map((g) => {
    const away = normalizeTeam(g.away_team);
    const home = normalizeTeam(g.home_team);
    const awayPicks = picksByTeam.get(away) || [];
    const homePicks = picksByTeam.get(home) || [];
    const totalPicks = awayPicks.length + homePicks.length;

    const dangerCount =
      awayPicks.filter((p) => Number(p.losses || 0) >= 1 && !p.is_eliminated).length +
      homePicks.filter((p) => Number(p.losses || 0) >= 1 && !p.is_eliminated).length;

    return {
      game: g,
      awayPicks,
      homePicks,
      totalPicks,
      dangerCount,
    };
  });

  const sortedGames = [...gamesWithMeta].sort((a, b) => {
    if (a.totalPicks > 0 && b.totalPicks === 0) return -1;
    if (a.totalPicks === 0 && b.totalPicks > 0) return 1;
    if (a.dangerCount !== b.dangerCount) return b.dangerCount - a.dangerCount;
    if (a.totalPicks !== b.totalPicks) return b.totalPicks - a.totalPicks;

    const aTime = a.game.kickoff_at ? new Date(a.game.kickoff_at).getTime() : 0;
    const bTime = b.game.kickoff_at ? new Date(b.game.kickoff_at).getTime() : 0;
    return aTime - bTime;
  });

  const dangerEntries = mappedPicks.filter(
    (p) => Number(p.losses || 0) >= 1 && !p.is_eliminated
  ).length;

  const activeGames = sortedGames.filter((g) => g.totalPicks > 0).length;

  let mostPickedTeam = "—";
  let mostPickedCount = 0;
  for (const [team, picks] of picksByTeam.entries()) {
    if (picks.length > mostPickedCount) {
      mostPickedTeam = team;
      mostPickedCount = picks.length;
    }
  }

  const sweatGames = sortedGames.filter((g) => g.totalPicks > 0).slice(0, 3);

  return (
    <main style={{ padding: 24, maxWidth: 1280, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div>
          <div style={{ fontSize: 32, fontWeight: 950, lineHeight: 1 }}>Game Day</div>
          <div style={{ marginTop: 6, fontSize: 14, opacity: 0.75 }}>
            Week {displayWeekNumber} live pool sweat
          </div>
        </div>

      </div>

      <section
        style={{
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 18,
          padding: 18,
          background: "rgba(255,255,255,0.03)",
          marginBottom: 20,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 12 }}>Top Sweat Games</div>

        {sweatGames.length === 0 ? (
          <div style={{ opacity: 0.6 }}>No picked games yet.</div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            {sweatGames.map(({ game, totalPicks, dangerCount }) => (
              <div
                key={game.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 14,
                  padding: 14,
                  background: "rgba(255,255,255,0.025)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div style={{ fontWeight: 900, fontSize: 16 }}>
                    {normalizeTeam(game.away_team)} @ {normalizeTeam(game.home_team)}
                  </div>
                  <GameStatusPill status={game.status} />
                </div>

                <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>
                  {totalPicks} total pick{totalPicks === 1 ? "" : "s"}
                </div>

                <div style={{ marginTop: 4, fontSize: 13, opacity: 0.8 }}>
                  {dangerCount} danger entr{dangerCount === 1 ? "y" : "ies"}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 16,
            padding: 16,
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.7 }}>Live Picks</div>
          <div style={{ fontSize: 28, fontWeight: 950, marginTop: 6 }}>{mappedPicks.length}</div>
        </div>

        <div
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 16,
            padding: 16,
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.7 }}>Danger Entries</div>
          <div style={{ fontSize: 28, fontWeight: 950, marginTop: 6 }}>{dangerEntries}</div>
        </div>

        <div
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 16,
            padding: 16,
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.7 }}>Most Picked Team</div>
          <div style={{ fontSize: 28, fontWeight: 950, marginTop: 6 }}>{mostPickedTeam}</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
            {mostPickedCount} pick{mostPickedCount === 1 ? "" : "s"}
          </div>
        </div>

        <div
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 16,
            padding: 16,
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.7 }}>Active Games</div>
          <div style={{ fontSize: 28, fontWeight: 950, marginTop: 6 }}>{activeGames}</div>
        </div>
      </section>

      <section
        style={{
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 18,
          padding: 18,
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 14 }}>
          Current Week Games
        </div>

        {sortedGames.length === 0 ? (
          <div style={{ opacity: 0.6 }}>No games found for this week.</div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {sortedGames.map(({ game, awayPicks, homePicks, totalPicks, dangerCount }) => (
              <div
                key={game.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 18,
                  padding: 16,
                  background: "rgba(255,255,255,0.025)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: 14,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>
                      {normalizeTeam(game.away_team)} @ {normalizeTeam(game.home_team)}
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>
                      {totalPicks} pick{totalPicks === 1 ? "" : "s"} • {dangerCount} danger
                    </div>
                  </div>

                  <GameStatusPill status={game.status} />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: 12,
                  }}
                >
                  <TeamPanel
                    team={game.away_team}
                    score={game.away_score}
                    picks={awayPicks}
                    game={game}
                  />
                  <TeamPanel
                    team={game.home_team}
                    score={game.home_score}
                    picks={homePicks}
                    game={game}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}