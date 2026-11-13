import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ArchivedStandings from "./ArchivedStandings";

export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ poolId: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const supabase = await createClient();
  const { poolId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("pool_members")
    .select("user_id")
    .eq("pool_id", poolId)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/");

  // Load completed seasons from the permanent archive.
  const { data: archives, error: archiveError } = await supabase
    .from("season_archives")
    .select("season_year, archived_at")
    .eq("pool_id", poolId)
    .order("season_year", { ascending: false });

  if (archiveError) {
    throw new Error(archiveError.message);
  }

  const archivedYears = (archives ?? []).map(
    (row) => Number(row.season_year)
  );

  const availableYears = Array.from(
    new Set([2026, ...archivedYears])
  ).sort((a, b) => b - a);

  const requestedYear = Number((await searchParams).year);

  const selectedYear = availableYears.includes(requestedYear)
    ? requestedYear
    : availableYears[0];

  const isArchived = archivedYears.includes(selectedYear);

  // Retrieve final standings only for completed, archived seasons.
  const archivedEntriesResponse = isArchived
    ? await supabase
        .from("season_archive_entries")
        .select(
          "user_id, entry_no, screen_name, full_name_line, losses, eliminated, finish_place, winnings_cents, picks"
        )
        .eq("pool_id", poolId)
        .eq("season_year", selectedYear)
        .order("finish_place", { ascending: true })
    : null;

  if (archivedEntriesResponse?.error) {
    throw new Error(archivedEntriesResponse.error.message);
  }

  const archivedEntries = archivedEntriesResponse?.data ?? [];





  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 30, fontWeight: 950 }}>
        Season History
      </h1>

      <div style={{ marginTop: 24 }}>
        <label htmlFor="history-year">Select Season</label>
        <div style={{ marginTop: 8 }}>
          <form method="get">
          <select
            id="history-year"
            name="year"
            defaultValue={String(selectedYear)}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              background: "#0f172a",
              color: "white",
              border: "1px solid rgba(255,255,255,0.25)",
            }}
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <button type="submit" style={{ marginLeft: 12, padding: 10 }}>
            View Season
          </button>
          </form>
        </div>
      </div>

      <div style={{
        marginTop: 28,
        padding: 24,
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.15)",
        background: "rgba(255,255,255,0.04)",
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 900 }}>
          {selectedYear} Season
        </h2>
        <p style={{ marginTop: 12, opacity: 0.75 }}>
          {isArchived
            ? "Final standings and winnings for this archived season."
            : "Season in progress. Final standings, weekly picks, finishing positions, and winnings will appear here after the season is completed and archived."}
        </p>
      </div>

      {isArchived && (
        <ArchivedStandings entries={archivedEntries} />
      )}
    </main>
  );
}
