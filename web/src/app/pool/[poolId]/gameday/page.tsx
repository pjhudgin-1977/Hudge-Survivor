import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type GameRow = {
  id: string;
  season_year: number | null;
  week_number: number | null;
  phase: string | null;
  kickoff_at: string | null;
  away_team: string | null;
  home_team: string | null;
  away_score: number | null;
  home_score: number | null;
  status: string | null;
  winner_team: string | null;
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

function normalizePhase(v: string | null | undefined) {
  const s = String(v ?? "").toLowerCase();
  if (s.includes("play")) return "playoffs";
  return "regular";
}

function phaseLabel(v: string | null | undefined) {
  return normalizePhase(v) === "playoffs" ? "Playoffs" : "Regular Season";
}

function gameStatusText(game: GameRow) {
  const status = String(game.status ?? "").trim();
  if (status) return status;

  const away = game.away_score ?? null;
  const home = game.home_score ?? null;

  if (away != null || home != null) return "Live";
  return "Scheduled";
}

export default async function GameDayPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const supabase = await createClient();
  const { poolId } = await params;

  const { data: latestSeasonGame } = await supabase
    .from("games")
    .select("season_year")
    .order("season_year", { ascending: false })
    .order("kickoff_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const displaySeasonYear = Number(
    (latestSeasonGame as any)?.season_year ?? new Date().getUTCFullYear()
  );

  const { data: nextGame } = await supabase
    .from("games")
    .select("season_year, week_number, phase, kickoff_at")
    .eq("season_year", displaySeasonYear)
    .gte("kickoff_at", new Date().toISOString())
    .order("kickoff_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let displayWeekNumber = Number((nextGame as any)?.week_number ?? 1);
  let displayPhase = normalizePhase((nextGame as any)?.phase ?? "regular");

  if (!nextGame) {
    const { data: latestGame } = await supabase
      .from("games")
      .select("season_year, week_number, phase, kickoff_at")
      .eq("season_year", displaySeasonYear)
      .order("kickoff_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    displayWeekNumber = Number((latestGame as any)?.week_number ?? 1);
    displayPhase = normalizePhase((latestGame as any)?.phase ?? "regular");
  }

  const { data: gamesData } = await supabase
    .from("games")
    .select(
      "id, season_year, week_number, phase, kickoff_at, away_team, home_team, away_score, home_score, status, winner_team"
    )
    .eq("season_year", displaySeasonYear)
    .eq("week_number", displayWeekNumber)
    .eq("phase", displayPhase)
    .order("kickoff_at", { ascending: true });

  const games = (gamesData ?? []) as GameRow[];

  const { data: picksData } = await supabase
    .from("picks")
    .select(
      "user_id, entry_no, week_number, phase, picked_team, result, was_autopick"
    )
    .eq("pool_id", poolId)
    .eq("week_number", displayWeekNumber)
    .eq("phase", displayPhase);

  const picks = (picksData ?? []) as PickRow[];

  const { data: membersData } = await supabase
    .from("pool_members")
    .select("user_id, entry_no, screen_name, losses, is_eliminated")
    .eq("pool_id", poolId)
    .order("entry_no", { ascending: true });

  const members = (membersData ?? []) as MemberRow[];

  const memberMap = new Map<string, MemberRow>();
  for (const m of members) {
    memberMap.set(`${m.user_id}|${Number(m.entry_no ?? 1)}`, m);
  }

  const pickRows = picks.map((p) => {
    const entryNo = Number(p.entry_no ?? 1);
    const member = memberMap.get(`${p.user_id}|${entryNo}`);
    const losses = Number(member?.losses ?? 0);
    const eliminated = Boolean(member?.is_eliminated) || losses >= 2;

    return {
      user_id: p.user_id,
      entry_no: entryNo,
      screen_name: `${
        String(member?.screen_name ?? "Player").trim() || "Player"
      } #${entryNo}`,
      picked_team: String(p.picked_team ?? "").trim(),
      result: String(p.result ?? "").trim(),
      was_autopick: Boolean(p.was_autopick),
      losses,
      eliminated,
      lastLife: !eliminated && losses === 1,
    };
  });

  const picksByTeam = new Map<string, typeof pickRows>();
  for (const row of pickRows) {
    const team = row.picked_team;
    if (!team) continue;
    if (!picksByTeam.has(team)) picksByTeam.set(team, []);
    picksByTeam.get(team)!.push(row);
  }

  const gameCards = games.map((game) => {
    const away = String(game.away_team ?? "").trim();
    const home = String(game.home_team ?? "").trim();
    const awayPickers = picksByTeam.get(away) ?? [];
    const homePickers = picksByTeam.get(home) ?? [];

    const awayLastLife = awayPickers.filter((p) => p.lastLife).length;
    const homeLastLife = homePickers.filter((p) => p.lastLife).length;

    return {
      ...game,
      awayPickers,
      homePickers,
      awayLastLife,
      homeLastLife,
    };
  });

  const sweatEntries = gameCards
    .flatMap((game) => {
      const awayScore = game.away_score ?? null;
      const homeScore = game.home_score ?? null;
      const winnerTeam = String(game.winner_team ?? "").trim();
      const status = String(game.status ?? "").toUpperCase();

      const rows: Array<{
        screen_name: string;
        picked_team: string;
        matchup: string;
        note: string;
        lastLife: boolean;
        dangerRank: number;
      }> = [];

      if (awayScore != null && homeScore != null) {
        if (status === "FINAL" && winnerTeam) {
          for (const p of game.awayPickers) {
            if (p.picked_team !== winnerTeam) {
              rows.push({
                screen_name: p.screen_name,
                picked_team: p.picked_team,
                matchup: `${game.away_team} @ ${game.home_team}`,
                note: "Lost",
                lastLife: p.lastLife,
                dangerRank: p.lastLife ? 1 : 2,
              });
            }
          }

          for (const p of game.homePickers) {
            if (p.picked_team !== winnerTeam) {
              rows.push({
                screen_name: p.screen_name,
                picked_team: p.picked_team,
                matchup: `${game.away_team} @ ${game.home_team}`,
                note: "Lost",
                lastLife: p.lastLife,
                dangerRank: p.lastLife ? 1 : 2,
              });
            }
          }
        } else {
          if (awayScore < homeScore) {
            for (const p of game.awayPickers) {
              rows.push({
                screen_name: p.screen_name,
                picked_team: p.picked_team,
                matchup: `${game.away_team} @ ${game.home_team}`,
                note: "Currently losing",
                lastLife: p.lastLife,
                dangerRank: p.lastLife ? 1 : 2,
              });
            }
          } else if (awayScore === homeScore) {
            for (const p of game.awayPickers) {
              rows.push({
                screen_name: p.screen_name,
                picked_team: p.picked_team,
                matchup: `${game.away_team} @ ${game.home_team}`,
                note: "Tied game",
                lastLife: p.lastLife,
                dangerRank: p.lastLife ? 3 : 4,
              });
            }
          }

          if (homeScore < awayScore) {
            for (const p of game.homePickers) {
              rows.push({
                screen_name: p.screen_name,
                picked_team: p.picked_team,
                matchup: `${game.away_team} @ ${game.home_team}`,
                note: "Currently losing",
                lastLife: p.lastLife,
                dangerRank: p.lastLife ? 1 : 2,
              });
            }
          } else if (homeScore === awayScore) {
            for (const p of game.homePickers) {
              rows.push({
                screen_name: p.screen_name,
                picked_team: p.picked_team,
                matchup: `${game.away_team} @ ${game.home_team}`,
                note: "Tied game",
                lastLife: p.lastLife,
                dangerRank: p.lastLife ? 3 : 4,
              });
            }
          }
        }
      }

      return rows;
    })
    .sort((a, b) => {
      if (a.dangerRank !== b.dangerRank) return a.dangerRank - b.dangerRank;
      return a.screen_name.localeCompare(b.screen_name);
    });

  const dangerRows = pickRows
    .filter((p) => p.lastLife)
    .sort((a, b) => a.screen_name.localeCompare(b.screen_name));

  return (
    <div style={{ padding: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 24, fontWeight: 950 }}>GameDay Dashboard</div>
          <div style={{ opacity: 0.75, marginTop: 4 }}>
            {displaySeasonYear} • Week {displayWeekNumber} •{" "}
            {phaseLabel(displayPhase)}
          </div>
        </div>

        <Link
          href={`/pool/${poolId}`}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            textDecoration: "none",
            fontWeight: 900,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.08)",
            color: "white",
          }}
        >
          ← Back to Dashboard
        </Link>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div style={cardStyle}>
          <div style={labelStyle}>Games</div>
          <div style={valueStyle}>{games.length}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Picked Entries</div>
          <div style={valueStyle}>{pickRows.length}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Sweating</div>
          <div style={valueStyle}>{sweatEntries.length}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Danger Zone</div>
          <div style={valueStyle}>{dangerRows.length}</div>
        </div>
      </div>

      <section style={sectionStyle}>
        <div style={sectionTitleStyle}>Current Week Games</div>

        <div style={{ display: "grid", gap: 12 }}>
          {gameCards.map((game) => (
            <div
              key={game.id}
              style={{
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
                padding: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 10,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontWeight: 950 }}>
                  {game.away_team} ({game.awayPickers.length}){" "}
                  {game.away_score ?? "—"} @ {game.home_team} (
                  {game.homePickers.length}) {game.home_score ?? "—"}
                </div>
                <div style={{ opacity: 0.75, fontWeight: 800 }}>
                  {gameStatusText(game)}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div style={teamBoxStyle}>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>
                    {game.away_team} picks ({game.awayPickers.length})
                  </div>

                  <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>
                    If {game.away_team} loses:{" "}
                    {game.awayLastLife > 0
                      ? `${game.awayLastLife} eliminated, ${
                          game.awayPickers.length - game.awayLastLife
                        } survive with a strike`
                      : game.awayPickers.length > 0
                      ? `${game.awayPickers.length} survive with a strike`
                      : "No pool impact"}
                  </div>

                  {game.awayPickers.length === 0 ? (
                    <div style={{ opacity: 0.6 }}>No picks</div>
                  ) : (
                    <div style={{ display: "grid", gap: 6 }}>
                      {game.awayPickers.map((p) => (
                        <div
                          key={`${p.user_id}|${p.entry_no}|away`}
                          style={{ fontWeight: 800 }}
                        >
                          {p.screen_name}
                          {p.was_autopick ? " • A" : ""}
                          {p.lastLife ? " • ⚠️" : ""}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={teamBoxStyle}>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>
                    {game.home_team} picks ({game.homePickers.length})
                  </div>

                  <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>
                    If {game.home_team} loses:{" "}
                    {game.homeLastLife > 0
                      ? `${game.homeLastLife} eliminated, ${
                          game.homePickers.length - game.homeLastLife
                        } survive with a strike`
                      : game.homePickers.length > 0
                      ? `${game.homePickers.length} survive with a strike`
                      : "No pool impact"}
                  </div>

                  {game.homePickers.length === 0 ? (
                    <div style={{ opacity: 0.6 }}>No picks</div>
                  ) : (
                    <div style={{ display: "grid", gap: 6 }}>
                      {game.homePickers.map((p) => (
                        <div
                          key={`${p.user_id}|${p.entry_no}|home`}
                          style={{ fontWeight: 800 }}
                        >
                          {p.screen_name}
                          {p.was_autopick ? " • A" : ""}
                          {p.lastLife ? " • ⚠️" : ""}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {gameCards.length === 0 && (
            <div style={{ opacity: 0.7 }}>No games found for this week.</div>
          )}
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={sectionTitleStyle}>Who Is Sweating</div>

        <div style={{ display: "grid", gap: 8 }}>
          {sweatEntries.length === 0 ? (
            <div style={{ opacity: 0.7 }}>No sweat entries right now.</div>
          ) : (
            sweatEntries.map((row, idx) => (
              <div
                key={`${row.screen_name}|${idx}`}
                style={{
                  ...listRowStyle,
                  border:
                    row.note === "Currently losing" || row.note === "Lost"
                      ? "1px solid rgba(255,120,120,0.35)"
                      : "1px solid rgba(255,255,255,0.10)",
                  background: row.lastLife
                    ? "rgba(255,165,0,0.10)"
                    : row.note === "Currently losing" || row.note === "Lost"
                    ? "rgba(255,0,0,0.08)"
                    : "rgba(0,0,0,0.14)",
                }}
              >
                <div style={{ fontWeight: 900 }}>
                  {row.screen_name}
                  {row.lastLife ? " • ⚠️" : ""}
                </div>
                <div>{row.picked_team}</div>
                <div>{row.matchup}</div>
                <div>
                  {row.note}
                  {row.lastLife ? " • Last life" : ""}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={sectionTitleStyle}>Danger Zone Entries</div>

        <div style={{ display: "grid", gap: 8 }}>
          {dangerRows.length === 0 ? (
            <div style={{ opacity: 0.7 }}>No entries on last life.</div>
          ) : (
            dangerRows.map((row) => (
              <div key={`${row.user_id}|${row.entry_no}`} style={listRowStyle}>
                <div style={{ fontWeight: 900 }}>{row.screen_name}</div>
                <div>{row.picked_team || "No pick yet"}</div>
                <div>Losses: {row.losses}</div>
                <div>⚠️ Last life</div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.05)",
  padding: "14px 16px",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  opacity: 0.72,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const valueStyle: React.CSSProperties = {
  marginTop: 8,
  fontSize: 24,
  fontWeight: 950,
};

const sectionStyle: React.CSSProperties = {
  marginTop: 24,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.04)",
  padding: 16,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 950,
  marginBottom: 12,
};

const teamBoxStyle: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.14)",
  padding: 12,
};

const listRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "minmax(180px, 1.2fr) minmax(120px, 1fr) minmax(140px, 1fr) minmax(140px, 1fr)",
  gap: 10,
  alignItems: "center",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.14)",
};