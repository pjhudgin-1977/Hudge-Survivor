import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type SeasonPhase = "regular" | "playoffs";

function formatFavorite(fav: any, spread: any) {
  const favorite = fav ? String(fav) : "";
  const pts = spread == null ? null : Number(spread);

  if (!favorite || pts == null || !Number.isFinite(pts) || pts <= 0) return "—";
  // Display like: CHI -6
  return `${favorite} -${pts}`;
}

function AutoPill() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        marginLeft: 10,
        padding: "2px 8px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.28)",
        background: "rgba(0,0,0,0.25)",
        fontSize: 12,
        fontWeight: 900,
        letterSpacing: 0.6,
        verticalAlign: "middle",
      }}
      title="This pick was automatically made by the system (Autopick)."
      aria-label="Autopick"
    >
      <span aria-hidden="true">⚙️</span>
      AUTO
    </span>
  );
}

export default async function PickPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const supabase = await createClient();
  const { poolId } = await params;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login");
  const userId = auth.user.id;

  const devUnlock = process.env.DEV_UNLOCK_PICKS === "1";

  // ✅ Find "current week" from the NEXT upcoming game (fallback earliest)
  const nowIso = new Date().toISOString();

  let g: any = null;

  const { data: nextGame } = await supabase
    .from("games")
    .select("season_year, week_number, phase, kickoff_at")
    .gte("kickoff_at", nowIso)
    .order("kickoff_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextGame) {
    g = nextGame;
  } else {
    const { data: firstGame, error: firstErr } = await supabase
      .from("games")
      .select("season_year, week_number, phase, kickoff_at")
      .order("kickoff_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (firstErr) {
      return (
        <main style={{ padding: 24 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800 }}>Make Your Pick</h1>
          <p style={{ marginTop: 10, color: "tomato" }}>
            Error loading pool state: {firstErr.message}
          </p>
          <div style={{ marginTop: 16 }}>
            <Link href={`/pool/${poolId}`}>← Back to Pool Dashboard</Link>
          </div>
        </main>
      );
    }
    g = firstGame;
  }

  const seasonYear = Number(g?.season_year ?? 2026);
  const weekNumber = Number(g?.week_number ?? 1);

  const phaseRaw = String(g?.phase ?? "regular").toLowerCase();
  const phase: SeasonPhase = phaseRaw.includes("play") ? "playoffs" : "regular";

  const week_type = phase === "regular" ? "REG" : "PLAYOFF";
  const weekLabel =
    phase === "regular" ? `Week ${weekNumber}` : `Playoff W${weekNumber}`;

  // ✅ Load games for this week/season
  const { data: games, error: gamesErr } = await supabase
    .from("games")
    .select(
      "id, kickoff_at, home_team, away_team, season_year, week_number, phase, favorite_team, spread_points"
    )
    .eq("season_year", seasonYear)
    .eq("week_number", weekNumber)
    .eq("phase", phase)
    .order("kickoff_at", { ascending: true });

  const teamSet = new Set<string>();
  for (const gm of games ?? []) {
    if (gm?.home_team) teamSet.add(String(gm.home_team));
    if (gm?.away_team) teamSet.add(String(gm.away_team));
  }
  const allTeamsThisWeek = Array.from(teamSet.values()).sort();

  // Existing pick (your schema has no season_year, so we match by week_number+phase)
  const { data: existingPick } = await supabase
    .from("picks")
    .select("id, picked_team, was_autopick")
    .eq("pool_id", poolId)
    .eq("user_id", userId)
    .eq("week_number", weekNumber)
    .eq("phase", phase)
    .maybeSingle();

  // ✅ Used teams for this user+pool (across ALL weeks)
  const { data: usedRows, error: usedErr } = await supabase
    .from("v_used_teams")
    .select("team")
    .eq("pool_id", poolId)
    .eq("user_id", userId);

  const usedSet = new Set<string>(
    (usedRows ?? [])
      .map((r: any) => (r?.team ? String(r.team) : ""))
      .filter(Boolean)
  );

  // ✅ Eligible teams = teams in this week's games MINUS used teams
  // BUT: keep the existingPick visible/selectable (so user can see it even if it is “used”)
  const eligibleTeams = allTeamsThisWeek.filter((t) => {
    if (existingPick?.picked_team && t === String(existingPick.picked_team)) return true;
    return !usedSet.has(t);
  });

  // Lock check ONLY against this season’s games
  const naturallyLocked = (games ?? []).some((gm: any) => {
    const t = gm?.kickoff_at ? new Date(gm.kickoff_at).getTime() : null;
    return t != null && t <= Date.now();
  });

  const locked = devUnlock ? false : naturallyLocked;

  return (
    <main style={{ padding: 24, maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>
            Make Your Pick
          </h1>
          <p style={{ marginTop: 8, opacity: 0.85 }}>
            Pool: <strong>{poolId}</strong>
            <br />
            Week:{" "}
            <strong>
              {phase} {weekNumber} ({seasonYear})
            </strong>
            {devUnlock ? (
              <>
                <br />
                <span style={{ fontWeight: 900 }}>🧪 DEV UNLOCK ON</span>
              </>
            ) : null}
          </p>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 900 }}>
            {locked ? `🔒 LOCKED — ${weekLabel}` : `✅ OPEN — ${weekLabel}`}
          </div>
          <div style={{ marginTop: 10 }}>
            <Link href={`/pool/${poolId}`} style={{ textDecoration: "none" }}>
              ← Dashboard
            </Link>
          </div>
        </div>
      </div>

      {gamesErr ? (
        <div
          style={{
            marginTop: 18,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(255,0,0,0.25)",
            background: "rgba(255,0,0,0.10)",
          }}
        >
          <strong>Error loading games:</strong>{" "}
          <span style={{ opacity: 0.9 }}>{gamesErr.message}</span>
        </div>
      ) : null}

      {usedErr ? (
        <div
          style={{
            marginTop: 18,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(255,0,0,0.25)",
            background: "rgba(255,0,0,0.10)",
          }}
        >
          <strong>Error loading used teams:</strong>{" "}
          <span style={{ opacity: 0.9 }}>{usedErr.message}</span>
        </div>
      ) : null}

      <div style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>
          Submit Pick
        </h2>

        {existingPick?.picked_team ? (
          <p style={{ marginTop: 0, opacity: 0.85 }}>
            Current pick: <strong>{existingPick.picked_team}</strong>
            {existingPick.was_autopick ? <AutoPill /> : null}
          </p>
        ) : (
          <p style={{ marginTop: 0, opacity: 0.85 }}>No pick submitted yet.</p>
        )}

        {!locked && usedSet.size > 0 ? (
          <div style={{ marginTop: 6, opacity: 0.8, fontSize: 13 }}>
            Note: teams you already used are disabled on this pick screen.
          </div>
        ) : null}

        {locked ? (
          <div style={{ opacity: 0.85 }}>
            Picks are locked for this week (games have started).
          </div>
        ) : (
          <form action={`/pool/${poolId}/pick/submit`} method="post">
            <input type="hidden" name="pool_id" value={poolId} />
            <input type="hidden" name="week_number" value={String(weekNumber)} />
            <input type="hidden" name="phase" value={phase} />
            <input type="hidden" name="week_type" value={week_type} />

            <div style={{ marginTop: 10 }}>
              <label
                style={{ display: "block", fontWeight: 800, marginBottom: 6 }}
              >
                Eligible teams
              </label>

              <select
                name="picked_team"
                defaultValue={existingPick?.picked_team ?? ""}
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(0,0,0,0.25)",
                }}
              >
                <option value="">— Select a team —</option>

                {allTeamsThisWeek.map((t) => {
                  const isUsed =
                    usedSet.has(t) &&
                    !(existingPick?.picked_team && t === String(existingPick.picked_team));

                  return (
                    <option key={t} value={t} disabled={isUsed}>
                      {t}
                      {isUsed ? " (used)" : ""}
                    </option>
                  );
                })}
              </select>

              <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
                Available this week: <strong>{eligibleTeams.length}</strong> /{" "}
                <strong>{allTeamsThisWeek.length}</strong>
              </div>
            </div>

            <button
              type="submit"
              style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: 12,
                fontWeight: 900,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,128,0,0.18)",
                cursor: "pointer",
              }}
            >
              Submit Pick
            </button>
          </form>
        )}
      </div>

      <div style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>
          This week’s games
        </h2>

        {(games ?? []).length === 0 ? (
          <div style={{ opacity: 0.85 }}>No games found for this week.</div>
        ) : (
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 160px",
                gap: 0,
                background: "rgba(0,0,0,0.18)",
                fontWeight: 900,
              }}
            >
              <div style={{ padding: "10px 12px" }}>Matchup</div>
              <div style={{ padding: "10px 12px", textAlign: "right" }}>
                Favorite
              </div>
            </div>

            {(games ?? []).map((gm: any) => (
              <div
                key={gm.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 160px",
                  borderTop: "1px solid rgba(255,255,255,0.10)",
                }}
              >
                <div style={{ padding: "10px 12px" }}>
                  <strong>
                    {gm.away_team} @ {gm.home_team}
                  </strong>{" "}
                  —{" "}
                  {gm.kickoff_at
                    ? new Date(gm.kickoff_at).toLocaleString()
                    : "TBD"}
                </div>

                <div
                  style={{
                    padding: "10px 12px",
                    textAlign: "right",
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  }}
                >
                  {formatFavorite(gm.favorite_team, gm.spread_points)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}