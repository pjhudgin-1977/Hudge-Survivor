"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

const supabase = createClient();
export default function SweatBoard() {
  const [status, setStatus] = useState("Loading...");
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("v_sweat_game_board")
        .select("*")
        .order("screen_name");

      if (error) {
        setStatus("Error: " + error.message);
        return;
      }

      setRows(data ?? []);
      setStatus(`Loaded ${data?.length ?? 0} rows ✅`);
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
              <td>{r.picked_team}</td>
              <td>{r.opponent_team ?? "—"}</td>
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
