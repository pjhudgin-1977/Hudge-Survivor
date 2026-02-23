import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PollingRefresh from "@/app/_components/PollingRefresh";
export default async function SweatPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const supabase = await createClient();
  const { poolId } = await params;

const { data: userRes } = await supabase.auth.getUser();
if (!userRes?.user) redirect("/login");

const { data: rows, error } = await supabase
  .from("v_sweat_game_board")
  .select("*")
  .eq("pool_id", poolId)
  .order("kickoff_at", { ascending: true });

const games = Object.values(
  (rows ?? []).reduce((acc: any, r: any) => {
    if (!acc[r.game_id]) {
      acc[r.game_id] = {
        game_id: r.game_id,
        kickoff_at: r.kickoff_at,
        home_team: r.home_team,
        away_team: r.away_team,
        picks: [],
      };
    }

    acc[r.game_id].picks.push(r);
    return acc;
  }, {})
);
 return (
  <main className="p-6 space-y-4">
    <PollingRefresh intervalMs={15000} />

    <h1 className="text-2xl font-semibold">Sweat</h1>
    <div className="opacity-70">
      Pool: <code>{poolId}</code>
    </div>

   <div
  style={{
    marginTop: 8,
    fontSize: 14,
    opacity: 0.85,
    display: "flex",
    flexWrap: "wrap",
    gap: 16,
  }}
>
  <span>✅ WIN</span>
  <span>❌ LOSS (includes TIE)</span>
  <span>⏱ LIVE</span>
  <span>⏳ PENDING</span>
  <span>☠️ OUT</span>
</div>
{error && <pre style={{ color: "crimson" }}>{error.message}</pre>}

<table
  border={1}
  cellPadding={8}
  style={{
    width: "100%",
    marginTop: 12,
    borderCollapse: "collapse",
    color: "#e5e7eb",
  }}
>  <thead>
<tr style={{ background: "#111827", color: "#e5e7eb", fontWeight: 700 }}>    <th align="left">Player</th>
    <th align="left">Pick</th>
    <th align="left">Opponent</th>
    <th align="left">Status</th>
    <th align="left">Result</th>
    <th align="left">Alive</th>
  </tr>
</thead>
  <tbody>
  {games.map((g: any) => (
    <React.Fragment key={g.game_id as string}>
     <tr style={{ background: "#0f172a", color: "#e5e7eb" }}>
  <td colSpan={6} style={{ padding: 10, fontWeight: 700 }}>
    {g.away_team} @ {g.home_team} —{" "}
    {g.kickoff_at ? new Date(g.kickoff_at).toLocaleString() : ""}
  </td>
</tr>

      {g.picks.map((r: any) => (
<tr
  key={`${r.user_id}-${r.game_id}`}
  style={{ background: "#0b1220", color: "#e5e7eb" }}
>
  <td style={{ borderTop: "1px solid #334155", padding: 8 }}>{r.screen_name}</td>
  <td style={{ borderTop: "1px solid #334155", padding: 8, fontWeight: 700 }}>
    {r.picked_team}
  </td>
  <td style={{ borderTop: "1px solid #334155", padding: 8 }}>{r.opponent_team}</td>
  <td style={{ borderTop: "1px solid #334155", padding: 8 }}>{r.game_status}</td>
  <td style={{ borderTop: "1px solid #334155", padding: 8 }}>
  {(() => {
    const pr = (r.pick_result ?? "").toLowerCase();
    if (pr === "win") return "✅ WIN";
    if (pr === "loss") return "❌ LOSS";
if (pr === "push" || pr === "tie") return "❌ LOSS";
    if (pr === "live" || pr === "in_progress") return "⏱ LIVE";
    return "⏳ PENDING";
  })()}
</td>

<td style={{ borderTop: "1px solid #334155", padding: 8 }}>
  {r.still_alive ? "✅ ALIVE" : "☠️ OUT"}
</td>
</tr>
      ))}
    </React.Fragment>
  ))}
</tbody>
</table>
    </main>
  );
}