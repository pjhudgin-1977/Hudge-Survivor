"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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

function normalizePhase(v: string | null | undefined) {
  const s = String(v ?? "").toLowerCase();
  if (s.includes("play")) return "playoffs";
  return "regular";
}

export default function PoolPickPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ poolId: string }>();
  const poolId = params.poolId;

  const entryNo = Math.max(1, Number(searchParams.get("entry") ?? "1") || 1);

  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState("");

  const [screenName, setScreenName] = useState<string | null>(null);
  const [poolMemberUserId, setPoolMemberUserId] = useState<string | null>(null);

  const [games, setGames] = useState<GameRow[]>([]);
  const [usedTeams, setUsedTeams] = useState<string[]>([]);
  const [existingPick, setExistingPick] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState("");

  const [isLocked, setIsLocked] = useState(false);
  const [seasonYear, setSeasonYear] = useState<number | null>(null);
  const [phase, setPhase] = useState<string | null>(null);
  const [weekNumber, setWeekNumber] = useState<number | null>(null);

  const weeklyTeams = useMemo(() => {
    const s = new Set<string>();
    for (const g of games) {
      s.add(g.home_team);
      s.add(g.away_team);
    }
    return Array.from(s).sort();
  }, [games]);

  const eligibleTeams = useMemo(() => {
    const used = new Set(usedTeams);
    return weeklyTeams.filter((t) => !used.has(t));
  }, [weeklyTeams, usedTeams]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setStatusMsg("");

        if (!poolId) return;

        const supabase = createClient();

        const { data: userRes } = await supabase.auth.getUser();
        const user = userRes?.user;

        if (cancelled) return;

        if (!user) {
          router.replace("/login");
          return;
        }

        const { data: ps, error: psErr } = await supabase
          .from("pool_state")
          .select("pool_id, season_year, week_type, week_number, picks_locked")
          .eq("pool_id", poolId)
          .maybeSingle<PoolStateRow>();

        if (cancelled) return;

        if (psErr) {
          setStatusMsg(`Error loading pool state: ${psErr.message}`);
          return;
        }

        if (!ps) {
          setStatusMsg(
            "Pool state not found. Go to Admin page and click Save once to initialize."
          );
          return;
        }

        const currentPhase = normalizePhase(ps.week_type);

        setSeasonYear(ps.season_year);
        setPhase(currentPhase);
        setWeekNumber(ps.week_number);
        setIsLocked(!!ps.picks_locked);

        const { data: member, error: memberErr } = await supabase
          .from("pool_members")
          .select("user_id, entry_no, screen_name")
          .eq("pool_id", poolId)
          .eq("user_id", user.id)
          .eq("entry_no", entryNo)
          .maybeSingle();

        if (cancelled) return;

        if (memberErr) {
          setStatusMsg(`Error loading pool member: ${memberErr.message}`);
          return;
        }

        if (!member) {
          setStatusMsg(`Entry ${entryNo} was not found for this pool.`);
          return;
        }

        setPoolMemberUserId(member.user_id);
        setScreenName(member.screen_name ?? null);

        const { data: gameRows, error: gamesErr } = await supabase
          .from("games")
          .select(
            "season_year, phase, week_number, home_team, away_team, kickoff_at"
          )
          .eq("season_year", ps.season_year)
          .eq("phase", currentPhase)
          .eq("week_number", ps.week_number)
          .order("kickoff_at", { ascending: true });

        if (cancelled) return;

        if (gamesErr) {
          setStatusMsg(`Error loading games: ${gamesErr.message}`);
          return;
        }

        setGames((gameRows ?? []) as GameRow[]);

        const { data: usedRows, error: usedErr } = await supabase
          .from("used_teams")
          .select("team_abbr")
          .eq("pool_id", poolId)
          .eq("user_id", member.user_id)
          .eq("entry_no", entryNo);

        if (cancelled) return;

        if (usedErr) {
          setStatusMsg(`Warning: could not load used teams: ${usedErr.message}`);
          setUsedTeams([]);
        } else {
          setUsedTeams((usedRows ?? []).map((r: any) => r.team_abbr));
        }

        const { data: pickRow, error: pickErr } = await supabase
          .from("picks")
          .select("picked_team")
          .eq("pool_id", poolId)
          .eq("user_id", member.user_id)
          .eq("entry_no", entryNo)
          .eq("phase", currentPhase)
          .eq("week_number", ps.week_number)
          .maybeSingle();

        if (cancelled) return;

        if (pickErr) {
          setStatusMsg(`Warning: could not load existing pick: ${pickErr.message}`);
          setExistingPick(null);
          setSelectedTeam("");
        } else {
          setExistingPick(pickRow?.picked_team ?? null);
          setSelectedTeam(pickRow?.picked_team ?? "");
        }
      } catch (e: any) {
        setStatusMsg(e?.message ?? "Unexpected error.");
      } finally {
        if (!cancelled) setLoading(false);
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
      setStatusMsg("Please select a team.");
      return;
    }

    if (seasonYear == null || phase == null || weekNumber == null) {
      setStatusMsg("Missing current week. Go to Admin and set week.");
      return;
    }

    if (!eligibleTeams.includes(selectedTeam) && existingPick !== selectedTeam) {
      setStatusMsg("That team is not eligible (already used or not playing this week).");
      return;
    }

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
      { onConflict: "pool_id,user_id,entry_no,phase,week_number" }
    );

    if (error) {
      setStatusMsg(`Submit failed: ${error.message}`);
      return;
    }

    setExistingPick(selectedTeam);
    setStatusMsg("✅ Pick saved.");
  }

  return (
    <main style={{ padding: 24, maxWidth: 560 }}>
      <h1 style={{ fontSize: 26, fontWeight: 800 }}>
        Week {weekNumber ?? "—"} Pick
      </h1>

      <div style={{ marginTop: 8, opacity: 0.85 }}>
        {screenName ? (
          <div>
            Player: <strong>{screenName}</strong>
          </div>
        ) : null}

        <div style={{ marginTop: 8 }}>
          <div style={{ marginBottom: 8, fontWeight: 700 }}>Entry</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[1, 2].map((n) => {
              const isActive = entryNo === n;

              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => router.push(`/pool/${poolId}/pick?entry=${n}`)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: isActive
                      ? "2px solid #f97316"
                      : "1px solid rgba(255,255,255,0.18)",
                    background: isActive ? "#f97316" : "rgba(255,255,255,0.06)",
                    color: isActive ? "#000" : "#fff",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Entry {n}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 8 }}>
          <Link
            href={`/pool/${poolId}/my-picks`}
            style={{
              display: "inline-block",
              padding: "8px 12px",
              borderRadius: 10,
              textDecoration: "none",
              fontWeight: 800,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.06)",
              color: "white",
            }}
          >
            View My Picks
          </Link>
        </div>

        {isLocked && (
          <div style={{ marginTop: 8, color: "#b00", fontWeight: 600 }}>
            🔒 Picks are locked for this week.
          </div>
        )}
      </div>

      {loading ? (
        <p style={{ marginTop: 16 }}>Loading…</p>
      ) : (
        <>
          <div style={{ marginTop: 18 }}>
            <div style={{ marginTop: 16, marginBottom: 8, fontWeight: 700 }}>
              Used teams
            </div>

            {usedTeams.length === 0 ? (
              <div style={{ opacity: 0.75, marginBottom: 14 }}>None yet</div>
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
                        border: "1px solid rgba(255,255,255,0.18)",
                        background: "rgba(255,255,255,0.06)",
                        fontWeight: 700,
                        fontSize: 14,
                      }}
                    >
                      {team}
                    </span>
                  ))}
              </div>
            )}

            <div style={{ marginTop: 16, marginBottom: 8, fontWeight: 700 }}>
              Eligible teams
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 14,
                marginTop: 12,
              }}
            >
              {games.flatMap((g) => {
                const teams = [g.home_team, g.away_team];

                return teams
                  .filter((t) => eligibleTeams.includes(t))
                  .map((team) => {
                    const isSelected = selectedTeam === team;
                    const opponent = team === g.home_team ? g.away_team : g.home_team;
                    const isHome = team === g.home_team;

                    return (
                      <button
                        key={`${team}-${g.home_team}-${g.away_team}-${g.kickoff_at}`}
                        type="button"
                        onClick={() => setSelectedTeam(team)}
                        style={{
                          padding: "14px",
                          borderRadius: 12,
                          border: isSelected
                            ? "2px solid #f97316"
                            : "1px solid rgba(255,255,255,0.18)",
                          background: isSelected ? "#f97316" : "#111827",
                          color: isSelected ? "#000" : "#fff",
                          fontWeight: 800,
                          cursor: "pointer",
                          textAlign: "left",
                          lineHeight: 1.4,
                          boxShadow: isSelected
                            ? "0 0 0 2px #fb923c, 0 4px 14px rgba(0,0,0,0.35)"
                            : "0 2px 6px rgba(0,0,0,0.35)",
                          transform: isSelected ? "scale(1.02)" : "scale(1)",
                          transition: "all .12s ease",
                        }}
                      >
                        <div style={{ fontSize: 18 }}>{team}</div>
                        <div style={{ opacity: 0.75 }}>
                          {isHome ? "vs" : "@"} {opponent}
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.65 }}>
                          {g.kickoff_at
                            ? new Date(g.kickoff_at).toLocaleString()
                            : ""}
                        </div>
                      </button>
                    );
                  });
              })}
            </div>

            <div
              style={{
                marginTop: 18,
                padding: 14,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.03)",
                display: "inline-block",
              }}
            >
              <button
                onClick={handleSubmit}
                disabled={isLocked || !selectedTeam}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  fontWeight: 800,
                  background: isLocked || !selectedTeam ? "#666" : "#f97316",
                  color: "#000",
                  border: "none",
                  cursor: isLocked || !selectedTeam ? "not-allowed" : "pointer",
                }}
              >
                Submit Pick
              </button>
            </div>

            <div style={{ marginTop: 10, opacity: 0.85 }}>
              {existingPick ? (
                <div>
                  Existing pick: <strong>{existingPick}</strong>
                </div>
              ) : (
                <div>No pick submitted yet.</div>
              )}
            </div>

            {statusMsg ? (
              <div
                style={{
                  marginTop: 10,
                  marginBottom: 28,
                  whiteSpace: "pre-wrap",
                }}
              >
                {statusMsg}
              </div>
            ) : null}
          </div>

          <div style={{ marginTop: 22 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>This week’s games</div>
            {games.length === 0 ? (
              <div style={{ opacity: 0.75 }}>No games found for this week.</div>
            ) : (
              <ul style={{ paddingLeft: 18, margin: 0 }}>
                {games.map((g, idx) => (
                  <li key={`${g.home_team}-${g.away_team}-${idx}`}>
                    {g.away_team} @ {g.home_team} —{" "}
                    {g.kickoff_at ? new Date(g.kickoff_at).toLocaleString() : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </main>
  );
}