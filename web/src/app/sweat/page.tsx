"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import {
  formatTeamRecord,
  loadTeamRecords,
  type TeamRecords,
} from "@/lib/teamRecords";

const supabase = createClient();
export default function SweatBoard() {
  const [status, setStatus] = useState("Loading...");
  const [rows, setRows] = useState<any[]>([]);
  const [teamRecords, setTeamRecords] = useState<TeamRecords>({});

  useEffect(() => {
    (async () => {
      const [{ data, error }, { data: latestSeason }] = await Promise.all([
        supabase.from("v_sweat_game_board").select("*").order("screen_name"),
        supabase
          .from("games")
          .select("season_year")
          .eq("phase", "regular")
          .order("season_year", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (error) {
        setStatus("Error: " + error.message);
        return;
      }

      setRows(data ?? []);
      setStatus(`Loaded ${data?.length ?? 0} rows ✅`);
      setTeamRecords(await loadTeamRecords(supabase, latestSeason?.season_year));
    })();
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1>Sweat Board</h1>
      <p>{status}</p>

      <table border={1} cellPadding={6}>
        <thead>
          <tr>
            <th>Player</th>
            <th>Pick</th>
            <th>Opponent</th>
            <th>Status</th>
            <th>Score</th>
            <th>Sweat</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.screen_name}</td>
              <td>{formatTeamRecord(r.picked_team, teamRecords)}</td>
              <td>{formatTeamRecord(r.opponent_team, teamRecords) ?? "—"}</td>
              <td>
  {r.game_status === "IN_PROGRESS"
    ? "🔴 LIVE"
    : r.game_status}
</td>
<td
  style={{
    fontWeight: 700,
    color:
      r.picked_side === "HOME"
        ? (r.home_score ?? 0) > (r.away_score ?? 0)
          ? "#0B6E4F"   // dark teal/green (winning)
          : "#D14900"   // orange-red (losing)
        : (r.away_score ?? 0) > (r.home_score ?? 0)
        ? "#0B6E4F"
        : "#D14900",
  }}
>
  {r.picked_side === "HOME"
    ? `${r.home_score ?? "—"}–${r.away_score ?? "—"}`
    : `${r.away_score ?? "—"}–${r.home_score ?? "—"}`}
</td>
<td>
  {(() => {
    const home = r.home_score ?? 0;
    const away = r.away_score ?? 0;

    const pickedScore = r.picked_side === "HOME" ? home : away;
    const opponentScore = r.picked_side === "HOME" ? away : home;

    const diff = pickedScore - opponentScore;

    if (diff > 7) return "🧊 SAFE";
    if (diff >= 0) return "😬 CLOSE";
    return "🔥 DANGER";
  })()}
</td>
</tr> 
          ))}
        </tbody>
      </table>
    </main>
  );
}
