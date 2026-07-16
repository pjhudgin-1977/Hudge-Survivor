"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useParams,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

type GameRow = {
  season_year: number;
  phase: string;
  week_number: number;
  home_team: string;
  away_team: string;
  kickoff_at: string;
};

type PoolStateRow = {
  pool_id: string;
  season_year: number;
  week_type: string;
  week_number: number;
  picks_locked: boolean;
};

function normalizePhase(value: string | null | undefined) {
  const normalized = String(value ?? "").toLowerCase();

  if (normalized.includes("play")) {
    return "playoffs";
  }

  return "regular";
}

export default function PoolPickPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ poolId: string }>();
  const poolId = params.poolId;

  const entryNo = Math.max(
    1,
    Number(searchParams.get("entry") ?? "1") || 1
  );

  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const [screenName, setScreenName] = useState<string | null>(null);
  const [poolMemberUserId, setPoolMemberUserId] = useState<
    string | null
  >(null);

  const [games, setGames] = useState<GameRow[]>([]);
  const [usedTeams, setUsedTeams] = useState<string[]>([]);
  const [existingPick, setExistingPick] = useState<string | null>(null);
  const [existingPickWasAutopick, setExistingPickWasAutopick] =
    useState(false);
  const [selectedTeam, setSelectedTeam] = useState("");

  const [isLocked, setIsLocked] = useState(false);
  const [seasonYear, setSeasonYear] = useState<number | null>(null);
  const [phase, setPhase] = useState<string | null>(null);
  const [weekNumber, setWeekNumber] = useState<number | null>(null);

  const weeklyTeams = useMemo(() => {
    const teams = new Set<string>();

    for (const game of games) {
      teams.add(game.home_team);
      teams.add(game.away_team);
    }

    return Array.from(teams).sort();
  }, [games]);

  const eligibleTeams = useMemo(() => {
    const used = new Set(usedTeams);

    return weeklyTeams.filter((team) => !used.has(team));
  }, [weeklyTeams, usedTeams]);

  function showTemporaryMessage(message: string) {
    setStatusMsg(message);

    if (messageTimerRef.current) {
      clearTimeout(messageTimerRef.current);
    }

    messageTimerRef.current = setTimeout(() => {
      setStatusMsg("");
      messageTimerRef.current = null;
    }, 5000);
  }

  useEffect(() => {
    return () => {
      if (messageTimerRef.current) {
        clearTimeout(messageTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setStatusMsg("");

        if (!poolId) {
          return;
        }

        const supabase = createClient();

        const { data: userResult } = await supabase.auth.getUser();
        const user = userResult?.user;

        if (cancelled) {
          return;
        }

        if (!user) {
          router.replace("/login");
          return;
        }

        const { data: poolState, error: poolStateError } =
          await supabase
            .from("pool_state")
            .select(
              "pool_id, season_year, week_type, week_number, picks_locked"
            )
            .eq("pool_id", poolId)
            .maybeSingle<PoolStateRow>();

        if (cancelled) {
          return;
        }

        if (poolStateError) {
          setStatusMsg(
            `Error loading pool state: ${poolStateError.message}`
          );
          return;
        }

        if (!poolState) {
          setStatusMsg(
            "Pool state not found. Go to Admin and save the pool settings once to initialize it."
          );
          return;
        }

        const currentPhase = normalizePhase(poolState.week_type);

        setSeasonYear(poolState.season_year);
        setPhase(currentPhase);
        setWeekNumber(poolState.week_number);
        setIsLocked(Boolean(poolState.picks_locked));

        const { data: member, error: memberError } = await supabase
          .from("pool_members")
          .select("user_id, entry_no, screen_name")
          .eq("pool_id", poolId)
          .eq("user_id", user.id)
          .eq("entry_no", entryNo)
          .maybeSingle();

        if (cancelled) {
          return;
        }

        if (memberError) {
          setStatusMsg(
            `Error loading pool member: ${memberError.message}`
          );
          return;
        }

        if (!member) {
          setStatusMsg(
            `Entry ${entryNo} was not found for this pool.`
          );
          return;
        }

        setPoolMemberUserId(member.user_id);
        setScreenName(member.screen_name ?? null);

        const { data: gameRows, error: gamesError } = await supabase
          .from("games")
          .select(
            "season_year, phase, week_number, home_team, away_team, kickoff_at"
          )
          .eq("season_year", poolState.season_year)
          .eq("phase", currentPhase)
          .eq("week_number", poolState.week_number)
          .order("kickoff_at", { ascending: true });

        if (cancelled) {
          return;
        }

        if (gamesError) {
          setStatusMsg(
            `Error loading games: ${gamesError.message}`
          );
          return;
        }

        setGames((gameRows ?? []) as GameRow[]);

        const { data: usedRows, error: usedError } = await supabase
          .from("used_teams")
          .select("team_abbr")
          .eq("pool_id", poolId)
          .eq("user_id", member.user_id)
          .eq("entry_no", entryNo);

        if (cancelled) {
          return;
        }

        if (usedError) {
          setStatusMsg(
            `Warning: could not load used teams: ${usedError.message}`
          );
          setUsedTeams([]);
        } else {
          setUsedTeams(
            (usedRows ?? []).map((row: { team_abbr: string }) =>
              String(row.team_abbr)
            )
          );
        }

        const { data: pickRow, error: pickError } = await supabase
          .from("picks")
          .select("picked_team, was_autopick")
          .eq("pool_id", poolId)
          .eq("user_id", member.user_id)
          .eq("entry_no", entryNo)
          .eq("phase", currentPhase)
          .eq("week_number", poolState.week_number)
          .maybeSingle();

        if (cancelled) {
          return;
        }

        if (pickError) {
          setStatusMsg(
            `Warning: could not load existing pick: ${pickError.message}`
          );
          setExistingPick(null);
          setExistingPickWasAutopick(false);
          setSelectedTeam("");
        } else {
          const pickedTeam = pickRow?.picked_team ?? null;

          setExistingPick(pickedTeam);
          setExistingPickWasAutopick(
            Boolean(pickRow?.was_autopick)
          );
          setSelectedTeam(pickedTeam ?? "");
        }
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : "Unexpected error.";

        setStatusMsg(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [router, poolId, entryNo]);

  async function handleSubmit() {
    setStatusMsg("");

    if (isLocked) {
      setStatusMsg("🔒 Picks are locked for this week.");
      return;
    }

    if (!poolMemberUserId) {
      setStatusMsg("Missing pool member. Try refreshing.");
      return;
    }

    if (!selectedTeam) {
      setStatusMsg("Select a team before saving your pick.");
      return;
    }

    if (
      seasonYear === null ||
      phase === null ||
      weekNumber === null
    ) {
      setStatusMsg(
        "Missing the current week. Go to Admin and set the week."
      );
      return;
    }

    if (
      !eligibleTeams.includes(selectedTeam) &&
      existingPick !== selectedTeam
    ) {
      setStatusMsg(
        "That team is not eligible because it was already used or is not playing this week."
      );
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.from("picks").upsert(
        [
          {
            pool_id: poolId,
            user_id: poolMemberUserId,
            entry_no: entryNo,
            phase,
            week_number: weekNumber,
            picked_team: selectedTeam,
            submitted_at: new Date().toISOString(),
          },
        ],
        {
          onConflict:
            "pool_id,user_id,entry_no,phase,week_number",
        }
      );

      if (error) {
        setStatusMsg(`Submit failed: ${error.message}`);
        return;
      }

      const previousPick = existingPick;

      setExistingPick(selectedTeam);
      setExistingPickWasAutopick(false);

      showTemporaryMessage(
        previousPick && previousPick !== selectedTeam
          ? `✅ Pick changed from ${previousPick} to ${selectedTeam}.`
          : `✅ ${selectedTeam} pick saved.`
      );
    } finally {
      setSubmitting(false);
    }
  }

  const pickChanged =
    Boolean(existingPick) &&
    Boolean(selectedTeam) &&
    existingPick !== selectedTeam;

  const submitDisabled =
    loading || submitting || isLocked || !selectedTeam;

  return (
    <main
      style={{
        width: "100%",
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      <h1 style={{ fontSize: 26, fontWeight: 800 }}>
        Week {weekNumber ?? "—"} Pick
      </h1>

      <div style={{ marginTop: 8, opacity: 0.9 }}>
        {screenName ? (
          <div>
            Player: <strong>{screenName}</strong>
          </div>
        ) : null}

        <div style={{ marginTop: 10 }}>
          <div style={{ marginBottom: 8, fontWeight: 700 }}>
            Entry
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {[1, 2].map((number) => {
              const active = entryNo === number;

              return (
                <button
                  key={number}
                  type="button"
                  onClick={() =>
                    router.push(
                      `/pool/${poolId}/pick?entry=${number}`
                    )
                  }
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: active
                      ? "2px solid #f97316"
                      : "1px solid rgba(255,255,255,0.18)",
                    background: active
                      ? "#f97316"
                      : "rgba(255,255,255,0.06)",
                    color: active ? "#000" : "#fff",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Entry {number}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <section
        style={{
          marginTop: 14,
          padding: 16,
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.18)",
          background: "#111827",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Link
            href={`/pool/${poolId}/my-picks`}
            style={{
              display: "inline-block",
              padding: "10px 14px",
              borderRadius: 10,
              textDecoration: "none",
              fontWeight: 800,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.08)",
              color: "white",
            }}
          >
            View My Picks
          </Link>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitDisabled}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              fontWeight: 800,
              background: submitDisabled ? "#64748b" : "#f97316",
              color: submitDisabled ? "#dbeafe" : "#000",
              border: "none",
              cursor: submitDisabled
                ? "not-allowed"
                : "pointer",
            }}
          >
            {submitting
              ? "Saving…"
              : isLocked
                ? "Picks Locked"
                : existingPick
                  ? "Save Pick Change"
                  : "Submit Pick"}
          </button>

          <Link
            href={`/pool/${poolId}/rules`}
            style={{
              display: "inline-block",
              padding: "10px 14px",
              borderRadius: 10,
              textDecoration: "none",
              fontWeight: 700,
              border: "1px solid rgba(255,255,255,0.18)",
              color: "white",
            }}
          >
            Rules
          </Link>
        </div>

        <div style={{ marginTop: 12 }}>
          {selectedTeam ? (
            <div>
              Selected team:{" "}
              <strong style={{ color: "#fdba74" }}>
                {selectedTeam}
              </strong>

              {pickChanged ? (
                <span style={{ marginLeft: 8, opacity: 0.8 }}>
                  Current saved pick: {existingPick}
                </span>
              ) : existingPickWasAutopick ? (
                <span style={{ marginLeft: 8, opacity: 0.8 }}>
                  AUTO
                </span>
              ) : null}
            </div>
          ) : (
            <div style={{ opacity: 0.75 }}>
              Select one eligible team below.
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: 8,
            fontSize: 13,
            opacity: 0.75,
          }}
        >
          Each entry has one pick per week. You may change that pick
          until picks lock; only the most recently saved team counts.
        </div>

        {statusMsg ? (
          <div
            role="status"
            aria-live="polite"
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 10,
              background: statusMsg.startsWith("✅")
                ? "rgba(34,197,94,0.14)"
                : "rgba(255,255,255,0.06)",
              fontWeight: 700,
              whiteSpace: "pre-wrap",
            }}
          >
            {statusMsg}
          </div>
        ) : null}

        {isLocked ? (
          <div
            style={{
              marginTop: 10,
              color: "#fca5a5",
              fontWeight: 800,
            }}
          >
            🔒 Picks are locked for this week.
          </div>
        ) : null}
      </section>

      {loading ? (
        <p style={{ marginTop: 18 }}>Loading…</p>
      ) : (
        <>
          <section style={{ marginTop: 20 }}>
            <div
              style={{
                marginBottom: 8,
                fontWeight: 700,
              }}
            >
              Used teams
            </div>

            {usedTeams.length === 0 ? (
              <div
                style={{
                  opacity: 0.75,
                  marginBottom: 14,
                }}
              >
                None yet
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                {usedTeams
                  .slice()
                  .sort()
                  .map((team) => (
                    <span
                      key={team}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        border:
                          "1px solid rgba(255,255,255,0.18)",
                        background:
                          "rgba(255,255,255,0.06)",
                        fontWeight: 700,
                        fontSize: 14,
                      }}
                    >
                      {team}
                    </span>
                  ))}
              </div>
            )}

            <div
              style={{
                marginTop: 16,
                marginBottom: 8,
                fontWeight: 700,
              }}
            >
              Eligible teams
            </div>

            {isLocked ? (
              <div
                style={{
                  marginBottom: 12,
                  opacity: 0.8,
                }}
              >
                Your existing pick is shown below and cannot be
                changed.
              </div>
            ) : null}

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 14,
                marginTop: 12,
              }}
            >
              {games.flatMap((game) => {
                const teams = [
                  game.home_team,
                  game.away_team,
                ];

                return teams
                  .filter((team) =>
                    eligibleTeams.includes(team)
                  )
                  .map((team) => {
                    const selected = selectedTeam === team;
                    const opponent =
                      team === game.home_team
                        ? game.away_team
                        : game.home_team;
                    const homeTeam =
                      team === game.home_team;

                    return (
                      <button
                        key={`${team}-${game.home_team}-${game.away_team}-${game.kickoff_at}`}
                        type="button"
                        disabled={isLocked || submitting}
                        onClick={() => {
                          if (isLocked || submitting) {
                            return;
                          }

                          setSelectedTeam(team);
                          setStatusMsg("");
                        }}
                        style={{
                          padding: 14,
                          borderRadius: 12,
                          border: selected
                            ? "2px solid #f97316"
                            : "1px solid rgba(255,255,255,0.18)",
                          background: selected
                            ? "#f97316"
                            : "#111827",
                          color: selected ? "#000" : "#fff",
                          fontWeight: 800,
                          cursor:
                            isLocked || submitting
                              ? "not-allowed"
                              : "pointer",
                          textAlign: "left",
                          lineHeight: 1.4,
                          opacity:
                            isLocked && !selected ? 0.55 : 1,
                          boxShadow: selected
                            ? "0 0 0 2px #fb923c, 0 4px 14px rgba(0,0,0,0.35)"
                            : "0 2px 6px rgba(0,0,0,0.35)",
                          transform: selected
                            ? "scale(1.02)"
                            : "scale(1)",
                          transition: "all .12s ease",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span style={{ fontSize: 18 }}>
                            {team}
                          </span>

                          {selected &&
                          existingPickWasAutopick &&
                          existingPick === team ? (
                            <span
                              style={{
                                padding: "3px 7px",
                                borderRadius: 999,
                                background:
                                  "rgba(0,0,0,0.22)",
                                fontSize: 10,
                                fontWeight: 900,
                                letterSpacing: 0.5,
                              }}
                            >
                              AUTO PICK
                            </span>
                          ) : null}
                        </div>

                        <div style={{ opacity: 0.75 }}>
                          {homeTeam ? "vs" : "@"} {opponent}
                        </div>

                        <div
                          style={{
                            fontSize: 12,
                            opacity: 0.65,
                          }}
                        >
                          {game.kickoff_at
                            ? new Date(
                                game.kickoff_at
                              ).toLocaleString()
                            : ""}
                        </div>
                      </button>
                    );
                  });
              })}
            </div>
          </section>

          <section style={{ marginTop: 24 }}>
            <div
              style={{
                fontWeight: 800,
                marginBottom: 6,
              }}
            >
              This week’s games
            </div>

            {games.length === 0 ? (
              <div style={{ opacity: 0.75 }}>
                No games found for this week.
              </div>
            ) : (
              <ul
                style={{
                  paddingLeft: 18,
                  margin: 0,
                }}
              >
                {games.map((game, index) => (
                  <li
                    key={`${game.home_team}-${game.away_team}-${index}`}
                  >
                    {game.away_team} @ {game.home_team} —{" "}
                    {game.kickoff_at
                      ? new Date(
                          game.kickoff_at
                        ).toLocaleString()
                      : ""}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}