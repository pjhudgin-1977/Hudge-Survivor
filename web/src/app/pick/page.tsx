"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

/**
 * ✅ Assumptions (adjust names if yours differ):
 * - pool_members: { id, pool_id, user_id, screen_name }
 * - games: { season_year, week_type, week_number, home_team, away_team, kickoff_ts }
 * - picks: { id, pool_id, pool_member_id, season_year, week_type, week_number, picked_team, submitted_at }
 * - used_teams: { pool_id, pool_member_id, team_code }  // or derive from prior picks
 *
 * If your column/table names differ, change ONLY the query strings/field names.
 */

type WeekType = "REG" | "POST";

type GameRow = {
  season_year: number;
  week_type: WeekType;
  week_number: number;
  home_team: string;
  away_team: string;
  kickoff_ts: string; // ISO timestamp in DB
};

export default function PoolPickPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams<{ poolId: string }>();
  const poolId = params.poolId;

  const [loading, setLoading] = useState(true);
  const [screenName, setScreenName] = useState<string | null>(null);
  const [poolMemberId, setPoolMemberId] = useState<string | null>(null);

  // If you already have “current week” in the pool record, replace these with that.
  const [seasonYear, setSeasonYear] = useState<number>(new Date().getFullYear());
  const [weekType, setWeekType] = useState<WeekType>("REG");
  const [weekNumber, setWeekNumber] = useState<number>(1);

  const [games, setGames] = useState<GameRow[]>([]);
  const [usedTeams, setUsedTeams] = useState<string[]>([]);
  const [existingPick, setExistingPick] = useState<string | null>(null);

  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>("");

  // Teams playing this week (unique)
  const weeklyTeams = useMemo(() => {
    const s = new Set<string>();
    for (const g of games) {
      s.add(g.home_team);
      s.add(g.away_team);
    }
    return Array.from(s).sort();
  }, [games]);

  // Teams you can still pick (playing this week AND not used)
  const eligibleTeams = useMemo(() => {
    const used = new Set(usedTeams);
    return weeklyTeams.filter((t) => !used.has(t));
  }, [weeklyTeams, usedTeams]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setStatusMsg("");

      // 1) Must be authed
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (userErr || !user) {
        router.replace("/login");
        return;
      }

      // 2) Find THIS user’s membership in THIS pool
      //    (Adjust column names if needed)
      const { data: member, error: memberErr } = await supabase
        .from("pool_members")
        .select("id, screen_name")
        .eq("pool_id", poolId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (memberErr) {
        setStatusMsg(`Error loading pool member: ${memberErr.message}`);
        setLoading(false);
        return;
      }
      if (!member) {
        setStatusMsg("You are not a member of this pool.");
        setLoading(false);
        return;
      }

      setPoolMemberId(member.id);
      setScreenName(member.screen_name ?? null);

      // 3) Load games for the selected week
      const { data: gameRows, error: gamesErr } = await supabase
        .from("games")
        .select("season_year, week_type, week_number, home_team, away_team, kickoff_ts")
        .eq("season_year", seasonYear)
        .eq("week_type", weekType)
        .eq("week_number", weekNumber)
        .order("kickoff_ts", { ascending: true });

      if (cancelled) return;

      if (gamesErr) {
        setStatusMsg(`Error loading games: ${gamesErr.message}`);
        setLoading(false);
        return;
      }

      const g = (gameRows ?? []) as GameRow[];
      setGames(g);

      // 4) Lock logic: locked if ANY kickoff has started (kickoff <= now)
      const now = Date.now();
      const locked = g.some((row) => {
        const t = new Date(row.kickoff_ts).getTime();
        return Number.isFinite(t) && t <= now;
      });
      setIsLocked(locked);

      // 5) Load used teams (preferred) OR derive from prior picks
      //    If you don’t have used_teams, skip this query and derive from picks history instead.
      const { data: usedRows, error: usedErr } = await supabase
        .from("used_teams")
        .select("team_code")
        .eq("pool_id", poolId)
        .eq("pool_member_id", member.id);

      if (cancelled) return;

      if (usedErr) {
        // Not fatal—some schemas don’t have this table. You can remove this block if needed.
        setStatusMsg((prev) => prev || `Warning: could not load used teams: ${usedErr.message}`);
        setUsedTeams([]);
      } else {
        setUsedTeams((usedRows ?? []).map((r: any) => r.team_code));
      }

      // 6) Load existing pick for this pool+member+week
      const { data: pickRow, error: pickErr } = await supabase
        .from("picks")
        .select("picked_team")
        .eq("pool_id", poolId)
        .eq("pool_member_id", member.id)
        .eq("season_year", seasonYear)
        .eq("week_type", weekType)
        .eq("week_number", weekNumber)
        .maybeSingle();

      if (cancelled) return;

      if (pickErr) {
        setStatusMsg((prev) => prev || `Error loading existing pick: ${pickErr.message}`);
        setExistingPick(null);
        setSelectedTeam("");
      } else {
        const picked = pickRow?.picked_team ?? null;
        setExistingPick(picked);
        setSelectedTeam(picked ?? "");
      }

      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [supabase, router, poolId, seasonYear, weekType, weekNumber]);

  async function handleSubmit() {
    setStatusMsg("");

    if (isLocked) {
      setStatusMsg("Picks are locked for this week (games have started).");
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
    if (!eligibleTeams.includes(selectedTeam) && existingPick !== selectedTeam) {
      setStatusMsg("That team is not eligible (already used or not playing this week).");
      return;
    }

    // Upsert pick for this pool+member+week
    const { error } = await supabase
      .from("picks")
      .upsert(
        {
          pool_id: poolId,
          pool_member_id: poolMemberId,
          season_year: seasonYear,
          week_type: weekType,
          week_number: weekNumber,
          picked_team: selectedTeam,
          submitted_at: new Date().toISOString(),
        },
        {
          onConflict: "pool_id,pool_member_id,season_year,week_type,week_number",
        }
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
          Week: <strong>{weekType} {weekNumber}</strong> ({seasonYear})
        </div>

        {isLocked && (
          <div style={{ marginTop: 8, color: "#b00", fontWeight: 600 }}>
            🔒 Picks are locked for this week (games have started).
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
              {/* If you already have a pick that’s now “ineligible”, still show it so it can display */}
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
                    {new Date(g.kickoff_ts).toLocaleString()}
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
