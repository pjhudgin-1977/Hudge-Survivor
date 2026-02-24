"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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

export default function PoolPickPage() {
  const router = useRouter();
  const params = useParams<{ poolId: string }>();
  const poolId = params.poolId;

  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string>("");

  const [screenName, setScreenName] = useState<string | null>(null);
  const [poolMemberId, setPoolMemberId] = useState<string | null>(null);

  const [games, setGames] = useState<GameRow[]>([]);
  const [usedTeams, setUsedTeams] = useState<string[]>([]);
  const [existingPick, setExistingPick] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string>("");

  // Admin-controlled state
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [seasonYear, setSeasonYear] = useState<number | null>(null);
  const [weekType, setWeekType] = useState<string | null>(null);
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

        // 1) Must be authed
        const { data: userRes } = await supabase.auth.getUser();
        const user = userRes?.user;

        if (cancelled) return;

        if (!user) {
          router.replace("/login");
          return;
        }

        // 2) Load pool_state (admin-controlled)
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

        setSeasonYear(ps.season_year);
        setWeekType(ps.week_type);
        setWeekNumber(ps.week_number);
        setIsLocked(!!ps.picks_locked);

        // 3) Pool membership (scoped by poolId + user)
        const { data: member, error: memberErr } = await supabase
          .from("pool_members")
          .select("user_id, screen_name")
          .eq("pool_id", poolId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (cancelled) return;

        if (memberErr) {
          setStatusMsg(`Error loading pool member: ${memberErr.message}`);
          return;
        }
        if (!member) {
          setStatusMsg("You are not a member of this pool.");
          return;
        }

        setPoolMemberId(member.user_id);
        setScreenName(member.screen_name ?? null);

        // 4) Load games for the admin-selected week
        const { data: gameRows, error: gamesErr } = await supabase
          .from("games")
          .select("season_year, phase, week_number, home_team, away_team, kickoff_at")
          .eq("season_year", ps.season_year)
          .eq("phase", ps.week_type)
          .eq("week_number", ps.week_number)
          .order("kickoff_at", { ascending: true });

        if (cancelled) return;

        if (gamesErr) {
          setStatusMsg(`Error loading games: ${gamesErr.message}`);
          return;
        }

        setGames((gameRows ?? []) as GameRow[]);

        // 5) Used teams (per pool+member)
        const { data: usedRows, error: usedErr } = await supabase
          .from("used_teams")
          .select("team_abbr")
          .eq("pool_id", poolId)
          .eq("user_id", member.user_id);

        if (cancelled) return;

        if (usedErr) {
          setStatusMsg(`Warning: could not load used teams: ${usedErr.message}`);
          setUsedTeams([]);
        } else {
          setUsedTeams((usedRows ?? []).map((r: any) => r.team_abbr));
        }

        // 6) Existing pick for THIS pool+member+week
        const { data: pickRow, error: pickErr } = await supabase
          .from("picks")
          .select("picked_team")
          .eq("pool_id", poolId)
          .eq("user_id", member.user_id)
          .eq("season_year", ps.season_year)
          .eq("week_type", ps.week_type)
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
  }, [router, poolId]);

  async function handleSubmit() {
    setStatusMsg("");

    if (isLocked) {
      setStatusMsg("🔒 Picks are locked for this week.");
      return;
    }
    if (!poolMemberId) {
      setStatusMsg("Missing pool member. Try refreshing.");
      return;
    }
    if (!selectedTeam) {
      setStatusMsg("Please select a team.");
      return;
    }
    if (seasonYear == null || weekType == null || weekNumber == null) {
      setStatusMsg("Missing current week. Go to Admin and set week.");
      return;
    }

    // Ensure team is eligible, unless it’s the same as existing pick
    if (!eligibleTeams.includes(selectedTeam) && existingPick !== selectedTeam) {
      setStatusMsg("That team is not eligible (already used or not playing this week).");
      return;
    }

    const supabase = createClient();

    const { error } = await supabase
      .from("picks")
      .upsert(
        [
          {
            pool_id: poolId,
            user_id: poolMemberId,
            season_year: seasonYear,
            week_type: weekType,
            week_number: weekNumber,
            picked_team: selectedTeam,
            submitted_at: new Date().toISOString(),
          },
        ],
        { onConflict: "pool_id,user_id,season_year,week_type,week_number" }
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
      <h1 style={{ fontSize: 26, fontWeight: 800 }}>Make Your Pick</h1>

      <div style={{ marginTop: 8, opacity: 0.85 }}>
        <div>
          Pool: <strong>{poolId}</strong>
        </div>
        {screenName ? (
          <div>
            Player: <strong>{screenName}</strong>
          </div>
        ) : null}

        <div>
          Week:{" "}
          <strong>
            {weekType ?? "?"} {weekNumber ?? "?"}
          </strong>{" "}
          ({seasonYear ?? "?"})
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
            <div style={{ marginBottom: 6, fontWeight: 700 }}>Eligible teams</div>

            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              disabled={isLocked}
              style={{ padding: 10, width: "100%", borderRadius: 8 }}
            >
              <option value="">— Select a team —</option>
              {eligibleTeams.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              {existingPick && !eligibleTeams.includes(existingPick) ? (
                <option value={existingPick}>{existingPick} (current pick)</option>
              ) : null}
            </select>

            <button
              onClick={handleSubmit}
              disabled={isLocked || !selectedTeam}
              style={{
                marginTop: 12,
                padding: "10px 14px",
                borderRadius: 10,
                fontWeight: 800,
                cursor: isLocked ? "not-allowed" : "pointer",
              }}
            >
              Submit Pick
            </button>

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
              <div style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>{statusMsg}</div>
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
