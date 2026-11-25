import GameScorePopup, { type GameScorePick } from "@/app/_components/GameScorePopup";
import TeamRecordLabel from "@/app/_components/TeamRecordLabel";
import { loadPoolTeamRecords } from "@/lib/teamRecords";
import { formatSignedSpread, getTeamPointSpread } from "@/lib/teamSpreads";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const NFL_TEAMS = [
  "ARI",
  "ATL",
  "BAL",
  "BUF",
  "CAR",
  "CHI",
  "CIN",
  "CLE",
  "DAL",
  "DEN",
  "DET",
  "GB",
  "HOU",
  "IND",
  "JAX",
  "KC",
  "LAC",
  "LAR",
  "LV",
  "MIA",
  "MIN",
  "NE",
  "NO",
  "NYG",
  "NYJ",
  "PHI",
  "PIT",
  "SEA",
  "SF",
  "TB",
  "TEN",
  "WAS",
] as const;

type MemberRow = {
  user_id: string;
  entry_no: number | null;
  screen_name: string | null;
  losses: number | null;
  is_eliminated: boolean | null;
};

type PickRow = {
  user_id: string;
  entry_no: number | null;
  picked_team: string | null;
  result: string | null;
  phase: string | null;
  week_number: number | null;
};

function sundayOnePmEt(reference: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(reference);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const weekday = get("weekday");
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));

  const weekdayIndex = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }[weekday as "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat"];

  const daysUntilSunday = (7 - weekdayIndex) % 7;
  const sundayDay = day + daysUntilSunday;

  for (let utcHour = 16; utcHour <= 19; utcHour++) {
    const candidate = new Date(
      Date.UTC(year, month - 1, sundayDay, utcHour, 0, 0)
    );

    const easternParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(candidate);

    const part = (type: string) =>
      easternParts.find((p) => p.type === type)?.value ?? "";

    if (
      Number(part("year")) === year &&
      Number(part("month")) === month &&
      Number(part("day")) === sundayDay &&
      Number(part("hour")) === 13 &&
      Number(part("minute")) === 0
    ) {
      return candidate;
    }
  }

  return null;
}

function normalizePhase(value: string | null | undefined) {
  const phase = String(value ?? "").toLowerCase();
  return phase.includes("play") ? "playoffs" : "regular";
}

export default async function TeamsLeftPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { poolId } = await params;
  const nowIso = new Date().toISOString();

  const { data: membership } = await supabase
    .from("pool_members")
    .select("user_id")
    .eq("pool_id", poolId)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/");

  const { data: poolState } = await supabase
    .from("pool_state")
    .select("season_year, week_type, week_number")
    .eq("pool_id", poolId)
    .maybeSingle();

  const seasonGames = () => {
    const query = supabase.from("games").select("season_year, phase, week_number, kickoff_at");
    return poolState?.season_year ? query.eq("season_year", poolState.season_year) : query;
  };

  const { data: nextGame } = await seasonGames()
    .gte("kickoff_at", nowIso)
    .order("kickoff_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let seasonYear = Number(nextGame?.season_year ?? 0);
  let phase = normalizePhase(nextGame?.phase);
  let currentWeek = Number(nextGame?.week_number ?? 0);

  if (!nextGame) {
    const { data: lastGame } = await seasonGames()
      .order("kickoff_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    seasonYear = Number(lastGame?.season_year ?? 0);
    phase = normalizePhase(lastGame?.phase);
    currentWeek = Number(lastGame?.week_number ?? 0);
  }

  const [
    { data: memberData, error: memberError },
    { data: pickData, error: pickError },
    { data: gameData, error: gameError },
    teamRecords,
  ] = await Promise.all([
    supabase
      .from("pool_members")
      .select("user_id, entry_no, screen_name, losses, is_eliminated")
      .eq("pool_id", poolId),
    supabase
      .from("picks")
      .select("user_id, entry_no, picked_team, result, phase, week_number")
      .eq("pool_id", poolId)
      .not("picked_team", "is", null),
    supabase
      .from("games")
      .select("season_year, week_number, phase, kickoff_at, home_team, away_team, favorite_team, point_spread")
      .eq("season_year", seasonYear),
    loadPoolTeamRecords(supabase, poolId, seasonYear),
  ]);

  const error =
    memberError?.message || pickError?.message || gameError?.message || "";
  const members = (memberData ?? []) as MemberRow[];
  const picks = (pickData ?? []) as PickRow[];

  const spreadsByTeam = new Map<string, number | null>();
  if (poolState) {
    const poolPhase = normalizePhase(poolState.week_type);
    for (const game of gameData ?? []) {
      if (
        game.season_year !== poolState.season_year ||
        normalizePhase(game.phase) !== poolPhase ||
        game.week_number !== poolState.week_number
      ) continue;

      for (const team of [game.home_team, game.away_team]) {
        if (team) spreadsByTeam.set(team, getTeamPointSpread(team, game));
      }
    }
  }

  const entryCounts = new Map<string, number>();

  for (const member of members) {
    entryCounts.set(
      member.user_id,
      (entryCounts.get(member.user_id) ?? 0) + 1
    );
  }

  const currentWeekReference =
    nextGame?.kickoff_at
      ? new Date(nextGame.kickoff_at)
      : new Date();

  const currentWeekLock = sundayOnePmEt(currentWeekReference);

  const currentWeekIsPublic =
    currentWeekLock !== null &&
    Date.now() >= currentWeekLock.getTime();

  const usedByEntry = new Map<string, Map<string, GameScorePick[]>>();

  for (const pick of picks) {
    if (normalizePhase(pick.phase) !== phase) continue;

    const team = String(pick.picked_team ?? "").trim().toUpperCase();

    const week = Number(pick.week_number ?? 0);
    if (week >= currentWeek) {
      const selectedGame = (gameData ?? []).find((game) => {
        const sameSeason =
          Number(game.season_year ?? 0) === seasonYear;
        const sameWeek =
          Number(game.week_number ?? 0) === Number(pick.week_number ?? 0);
        const samePhase =
          normalizePhase(game.phase) === normalizePhase(pick.phase);

        return (
          sameSeason &&
          sameWeek &&
          samePhase &&
          (String(game.home_team ?? "").toUpperCase() === team ||
            String(game.away_team ?? "").toUpperCase() === team)
        );
      });

      const selectedGameStarted =
        Boolean(selectedGame?.kickoff_at) &&
        new Date(selectedGame!.kickoff_at).getTime() <= Date.now();

      if (!(week === currentWeek && currentWeekIsPublic) && !selectedGameStarted) {
        continue;
      }
    }
    if (!team) continue;

    const key = `${pick.user_id}|${Number(pick.entry_no ?? 1)}`;

    if (!usedByEntry.has(key)) {
      usedByEntry.set(key, new Map());
    }

    const used = usedByEntry.get(key)!;
    const teamPicks = used.get(team) ?? [];
    teamPicks.push({ week, phase, result: pick.result });
    used.set(team, teamPicks);
  }

  const rows = members
    .map((member) => {
      const entryNo = Number(member.entry_no ?? 1);
      const baseName =
        String(member.screen_name ?? "").trim() || "Player";

      const displayName =
        (entryCounts.get(member.user_id) ?? 0) > 1
          ? `${baseName} #${entryNo}`
          : baseName;

      const losses = Number(member.losses ?? 0);
      const eliminated =
        Boolean(member.is_eliminated) || losses >= 2;

      const key = `${member.user_id}|${entryNo}`;
      const used = usedByEntry.get(key) ?? new Map<string, GameScorePick[]>();
      const remaining = NFL_TEAMS.filter((team) => !used.has(team));

      return {
        key,
        displayName,
        entryNo,
        losses,
        eliminated,
        used: Array.from(used, ([team, picks]) => picks.map((pick) => ({ team, pick })))
          .flat()
          .sort((a, b) => (a.pick.week || Infinity) - (b.pick.week || Infinity) ||
            a.team.localeCompare(b.team)),
        remaining,
      };
    })
    .sort((a, b) => {
      if (a.eliminated !== b.eliminated) {
        return a.eliminated ? 1 : -1;
      }

      return a.displayName.localeCompare(b.displayName);
    });

  const phaseLabel =
    phase === "playoffs" ? "Playoffs" : "Regular Season";

  return (
    <main
      style={{
        width: "100%",
        maxWidth: 1100,
        margin: "0 auto",
        padding: "32px 18px 48px",
        boxSizing: "border-box",
      }}
    >
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 14,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 30,
              fontWeight: 950,
            }}
          >
            Teams Left
          </h1>

          <p
            style={{
              margin: "7px 0 0",
              opacity: 0.72,
              lineHeight: 1.5,
            }}
          >
            See which NFL teams each entry has used and still has
            available.
          </p>
        </div>

        <Link
          href={`/pool/${poolId}`}
          style={{
            display: "inline-block",
            padding: "9px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.22)",
            background: "rgba(255,255,255,0.08)",
            color: "white",
            fontWeight: 850,
            textDecoration: "none",
          }}
        >
          Back to Dashboard
        </Link>
      </header>

      <section
        style={{
          marginTop: 20,
          padding: "12px 14px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(255,255,255,0.05)",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ fontWeight: 900 }}>{phaseLabel}</div>

        <div style={{ opacity: 0.72, fontSize: 14 }}>
          Team availability resets when the playoffs begin.
        </div>
      </section>

      {error ? (
        <div
          style={{
            marginTop: 18,
            padding: 14,
            borderRadius: 12,
            border: "1px solid rgba(248,113,113,0.4)",
            background: "rgba(127,29,29,0.2)",
            color: "#fecaca",
          }}
        >
          Could not load teams: {error}
        </div>
      ) : null}

      <section
        style={{
          marginTop: 18,
          display: "grid",
          gap: 16,
        }}
      >
        {rows.map((entry) => (
          <article
            key={entry.key}
            style={{
              padding: 18,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.16)",
              background: entry.eliminated
                ? "rgba(255,255,255,0.035)"
                : "rgba(10,12,18,0.66)",
              opacity: entry.eliminated ? 0.7 : 1,
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 950,
                  }}
                >
                  {entry.displayName}
                </div>

                <div
                  style={{
                    marginTop: 4,
                    fontSize: 13,
                    opacity: 0.68,
                  }}
                >
                  Entry {entry.entryNo} · Losses: {entry.losses}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: entry.eliminated
                      ? "1px solid rgba(248,113,113,0.38)"
                      : "1px solid rgba(134,239,172,0.38)",
                    background: entry.eliminated
                      ? "rgba(127,29,29,0.2)"
                      : "rgba(22,101,52,0.22)",
                    color: entry.eliminated
                      ? "#fecaca"
                      : "#bbf7d0",
                    fontSize: 13,
                    fontWeight: 900,
                  }}
                >
                  {entry.eliminated ? "Eliminated" : "Alive"}
                </span>

                <span
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid rgba(251,146,60,0.4)",
                    background: "rgba(154,52,18,0.2)",
                    color: "#fed7aa",
                    fontSize: 13,
                    fontWeight: 900,
                  }}
                >
                  {entry.remaining.length} of 32 left
                </span>
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <div
                style={{
                  marginBottom: 9,
                  fontSize: 13,
                  fontWeight: 950,
                  letterSpacing: 0.4,
                  textTransform: "uppercase",
                  opacity: 0.7,
                }}
              >
                Teams remaining
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fill, minmax(min(100%, 78px), 1fr))",
                  gap: "clamp(6px, 1.5vw, 10px)",
                }}
              >
                {entry.remaining.map((team) => {
                  const spread = spreadsByTeam.get(team);
                  const spreadLabel = spread === undefined && spreadsByTeam.size > 0 ? "BYE"
                    : spread == null ? "TBD"
                    : spread === 0 ? "Pick'em"
                    : formatSignedSpread(spread);

                  return (
                    <div
                      key={`${entry.key}-remaining-${team}`}
                      style={{
                        display: "grid",
                        gridTemplateRows: "1fr auto",
                        placeItems: "center",
                        minHeight: 94,
                        padding: "6px",
                        borderRadius: 10,
                        border: "1px solid rgba(251,146,60,0.36)",
                        background: "rgba(154,52,18,0.18)",
                        color: "#ffedd5",
                        textAlign: "center",
                        fontWeight: 950,
                      }}
                    >
                      <TeamRecordLabel team={team} records={teamRecords} />
                      <span
                        style={{
                          width: "100%",
                          borderTop: "1px solid rgba(255,237,213,0.2)",
                          paddingTop: 4,
                          fontSize: 12,
                          lineHeight: 1.25,
                          color: spread != null && spread < 0 ? "#fdba74" : "#e5e7eb",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {spreadLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <div
                style={{
                  marginBottom: 9,
                  fontSize: 13,
                  fontWeight: 950,
                  letterSpacing: 0.4,
                  textTransform: "uppercase",
                  opacity: 0.58,
                }}
              >
                Teams used
              </div>

              {entry.used.length ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 86px), 1fr))",
                    gap: "clamp(6px, 1.5vw, 10px)",
                  }}
                >
                  {entry.used.map(({ team, pick }) => (
                    <GameScorePopup
                      key={`${pick.phase}-${pick.week}-${team}`}
                      team={team}
                      season={poolState?.season_year}
                      pick={pick}
                      records={teamRecords}
                      variant="chip"
                      stacked
                    />
                  ))}
                </div>
              ) : (
                <div style={{ opacity: 0.55, fontSize: 14 }}>
                  No teams used yet.
                </div>
              )}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
