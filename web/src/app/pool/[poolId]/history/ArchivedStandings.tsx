type ArchivedPick = {
  week_number?: number;
  phase?: string;
  picked_team?: string;
  was_autopick?: boolean;
  result?: string;
  counted_in_losses?: boolean;
};

export type ArchivedEntry = {
  user_id: string;
  entry_no: number;
  screen_name: string;
  full_name_line: string | null;
  losses: number;
  eliminated: boolean;
  finish_place: number | null;
  winnings_cents: number;
  picks: unknown;
};

const columns = [
  ...Array.from({ length: 18 }, (_, i) => ({
    label: `W${i + 1}`,
    phase: "regular",
    week: i + 1,
  })),
  ...Array.from({ length: 4 }, (_, i) => ({
    label: `P${i + 1}`,
    phase: "playoffs",
    week: i + 1,
  })),
];

const money = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(cents / 100);

export default function ArchivedStandings({
  entries,
}: {
  entries: ArchivedEntry[];
}) {
  const placeCounts = new Map<number, number>();

  for (const entry of entries) {
    if (entry.finish_place !== null) {
      placeCounts.set(
        entry.finish_place,
        (placeCounts.get(entry.finish_place) ?? 0) + 1
      );
    }
  }

  const sorted = [...entries].sort(
    (a, b) =>
      (a.finish_place ?? 9999) - (b.finish_place ?? 9999) ||
      a.screen_name.localeCompare(b.screen_name)
  );

  if (!sorted.length) {
    return <p>No archived standings are available yet.</p>;
  }

  return (
    <div style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 14 }}>
        Final Standings
      </h2>

      <div style={{ overflowX: "auto", borderRadius: 12 }}>
        <table
          style={{
            borderCollapse: "collapse",
            width: "100%",
            minWidth: 1900,
            fontSize: 13,
          }}
        >
          <thead>
            <tr style={{ background: "#1e293b" }}>
              {["Place", "Players", "Winnings", ...columns.map(c => c.label)].map(
                (label) => (
                  <th
                    key={label}
                    style={{
                      padding: "12px 10px",
                      textAlign: label === "Players" ? "left" : "center",
                      whiteSpace: "nowrap",
                      borderBottom: "1px solid #475569",
                    }}
                  >
                    {label}
                  </th>
                )
              )}
            </tr>
          </thead>

          <tbody>
            {sorted.map((entry) => {
              const picks: ArchivedPick[] = Array.isArray(entry.picks)
                ? entry.picks
                : [];

              const place = entry.finish_place;
              const tied =
                place !== null && (placeCounts.get(place) ?? 0) > 1;

              return (
                <tr
                  key={`${entry.user_id}-${entry.entry_no}`}
                  style={{
                    background: entry.eliminated
                      ? "rgba(255,255,255,0.04)"
                      : "rgba(245,158,11,0.07)",
                  }}
                >
                  <td style={{ padding: 10, textAlign: "center" }}>
                    {place === null ? "—" : `${tied ? "T-" : ""}${place}`}
                  </td>

                  <td style={{ padding: 10, minWidth: 175 }}>
                    <div style={{ fontWeight: 950 }}>
                      {entry.screen_name}
                    </div>
                    {entry.full_name_line && (
                      <div style={{ fontSize: 11, opacity: 0.7 }}>
                        {entry.full_name_line}
                      </div>
                    )}
                    <div style={{ fontSize: 11, opacity: 0.75 }}>
                      L: {entry.losses}
                    </div>
                  </td>

                  <td
                    style={{
                      padding: 10,
                      textAlign: "center",
                      fontWeight: 950,
                      whiteSpace: "nowrap",
                      color:
                        entry.winnings_cents > 0
                          ? "#fde68a"
                          : "rgba(255,255,255,0.6)",
                    }}
                  >
                    {money(entry.winnings_cents)}
                  </td>

                  {columns.map((col) => {
                    const pick = picks.find(
                      (p) =>
                        Number(p.week_number) === col.week &&
                        String(p.phase ?? "").toLowerCase() === col.phase
                    );

                    const team = String(pick?.picked_team ?? "");
                    const loss =
                      pick?.counted_in_losses === true ||
                      String(pick?.result ?? "").toLowerCase() === "loss";

                    return (
                      <td
                        key={`${col.phase}-${col.week}`}
                        style={{
                          padding: "10px 8px",
                          minWidth: 65,
                          textAlign: "center",
                          fontWeight: 900,
                          whiteSpace: "nowrap",
                          borderBottom:
                            "1px solid rgba(255,255,255,0.08)",
                          textDecoration: loss ? "line-through" : "none",
                          opacity: team ? 0.95 : 0.35,
                        }}
                      >
                        {team
                          ? `${team}${pick?.was_autopick ? " a" : ""}`
                          : "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
