import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const NFL_TEAMS = [
  "ARI",
  "ATL",
  "BAL",
  "BUF",
  "CAR",
  "CHI",
  "CIN",
  "CLE",
  "DAL",
  "DEN",
  "DET",
  "GB",
  "HOU",
  "IND",
  "JAX",
  "KC",
  "LAC",
  "LAR",
  "LV",
  "MIA",
  "MIN",
  "NE",
  "NO",
  "NYG",
  "NYJ",
  "PHI",
  "PIT",
  "SEA",
  "SF",
  "TB",
  "TEN",
  "WAS",
] as const;

type MemberRow = {
  user_id: string;
  entry_no: number | null;
  screen_name: string | null;
  losses: number | null;
  is_eliminated: boolean | null;
};

type PickRow = {
  user_id: string;
  entry_no: number | null;
  picked_team: string | null;
  phase: string | null;
};

function normalizePhase(value: string | null | undefined) {
  const phase = String(value ?? "").toLowerCase();
  return phase.includes("play") ? "playoffs" : "regular";
}

export default async function TeamsLeftPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { poolId } = await params;
  const nowIso = new Date().toISOString();

  const { data: membership } = await supabase
    .from("pool_members")
    .select("user_id")
    .eq("pool_id", poolId)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/");

  const { data: nextGame } = await supabase
    .from("games")
    .select("phase")
    .gte("kickoff_at", nowIso)
    .order("kickoff_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let phase = normalizePhase(nextGame?.phase);

  if (!nextGame) {
    const { data: lastGame } = await supabase
      .from("games")
      .select("phase")
      .order("kickoff_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    phase = normalizePhase(lastGame?.phase);
  }

  const [
    { data: memberData, error: memberError },
    { data: pickData, error: pickError },
  ] = await Promise.all([
    supabase
      .from("pool_members")
      .select("user_id, entry_no, screen_name, losses, is_eliminated")
      .eq("pool_id", poolId),
    supabase
      .from("picks")
      .select("user_id, entry_no, picked_team, phase")
      .eq("pool_id", poolId)
      .not("picked_team", "is", null),
  ]);

  const error = memberError?.message || pickError?.message || "";
  const members = (memberData ?? []) as MemberRow[];
  const picks = (pickData ?? []) as PickRow[];

  const entryCounts = new Map<string, number>();

  for (const member of members) {
    entryCounts.set(
      member.user_id,
      (entryCounts.get(member.user_id) ?? 0) + 1
    );
  }

  const usedByEntry = new Map<string, Set<string>>();

  for (const pick of picks) {
    if (normalizePhase(pick.phase) !== phase) continue;

    const team = String(pick.picked_team ?? "").trim().toUpperCase();
    if (!team) continue;

    const key = `${pick.user_id}|${Number(pick.entry_no ?? 1)}`;

    if (!usedByEntry.has(key)) {
      usedByEntry.set(key, new Set<string>());
    }

    usedByEntry.get(key)?.add(team);
  }

  const rows = members
    .map((member) => {
      const entryNo = Number(member.entry_no ?? 1);
      const baseName =
        String(member.screen_name ?? "").trim() || "Player";

      const displayName =
        (entryCounts.get(member.user_id) ?? 0) > 1
          ? `${baseName} #${entryNo}`
          : baseName;

      const losses = Number(member.losses ?? 0);
      const eliminated =
        Boolean(member.is_eliminated) || losses >= 2;

      const key = `${member.user_id}|${entryNo}`;
      const used = usedByEntry.get(key) ?? new Set<string>();
      const remaining = NFL_TEAMS.filter((team) => !used.has(team));

      return {
        key,
        displayName,
        entryNo,
        losses,
        eliminated,
        used: Array.from(used).sort(),
        remaining,
      };
    })
    .sort((a, b) => {
      if (a.eliminated !== b.eliminated) {
        return a.eliminated ? 1 : -1;
      }

      return a.displayName.localeCompare(b.displayName);
    });

  const phaseLabel =
    phase === "playoffs" ? "Playoffs" : "Regular Season";

  return (
    <main
      style={{
        width: "100%",
        maxWidth: 1100,
        margin: "0 auto",
        padding: "32px 18px 48px",
        boxSizing: "border-box",
      }}
    >
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 14,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 30,
              fontWeight: 950,
            }}
          >
            Teams Left
          </h1>

          <p
            style={{
              margin: "7px 0 0",
              opacity: 0.72,
              lineHeight: 1.5,
            }}
          >
            See which NFL teams each entry has used and still has
            available.
          </p>
        </div>

        <Link
          href={`/pool/${poolId}`}
          style={{
            display: "inline-block",
            padding: "9px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.22)",
            background: "rgba(255,255,255,0.08)",
            color: "white",
            fontWeight: 850,
            textDecoration: "none",
          }}
        >
          Back to Dashboard
        </Link>
      </header>

      <section
        style={{
          marginTop: 20,
          padding: "12px 14px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(255,255,255,0.05)",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ fontWeight: 900 }}>{phaseLabel}</div>

        <div style={{ opacity: 0.72, fontSize: 14 }}>
          Team availability resets when the playoffs begin.
        </div>
      </section>

      {error ? (
        <div
          style={{
            marginTop: 18,
            padding: 14,
            borderRadius: 12,
            border: "1px solid rgba(248,113,113,0.4)",
            background: "rgba(127,29,29,0.2)",
            color: "#fecaca",
          }}
        >
          Could not load teams: {error}
        </div>
      ) : null}

      <section
        style={{
          marginTop: 18,
          display: "grid",
          gap: 16,
        }}
      >
        {rows.map((entry) => (
          <article
            key={entry.key}
            style={{
              padding: 18,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.16)",
              background: entry.eliminated
                ? "rgba(255,255,255,0.035)"
                : "rgba(10,12,18,0.66)",
              opacity: entry.eliminated ? 0.7 : 1,
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 950,
                  }}
                >
                  {entry.displayName}
                </div>

                <div
                  style={{
                    marginTop: 4,
                    fontSize: 13,
                    opacity: 0.68,
                  }}
                >
                  Entry {entry.entryNo} · Losses: {entry.losses}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: entry.eliminated
                      ? "1px solid rgba(248,113,113,0.38)"
                      : "1px solid rgba(134,239,172,0.38)",
                    background: entry.eliminated
                      ? "rgba(127,29,29,0.2)"
                      : "rgba(22,101,52,0.22)",
                    color: entry.eliminated
                      ? "#fecaca"
                      : "#bbf7d0",
                    fontSize: 13,
                    fontWeight: 900,
                  }}
                >
                  {entry.eliminated ? "Eliminated" : "Alive"}
                </span>

                <span
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid rgba(251,146,60,0.4)",
                    background: "rgba(154,52,18,0.2)",
                    color: "#fed7aa",
                    fontSize: 13,
                    fontWeight: 900,
                  }}
                >
                  {entry.remaining.length} of 32 left
                </span>
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <div
                style={{
                  marginBottom: 9,
                  fontSize: 13,
                  fontWeight: 950,
                  letterSpacing: 0.4,
                  textTransform: "uppercase",
                  opacity: 0.7,
                }}
              >
                Teams remaining
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(58px, 1fr))",
                  gap: 8,
                }}
              >
                {entry.remaining.map((team) => (
                  <div
                    key={`${entry.key}-remaining-${team}`}
                    style={{
                      padding: "9px 6px",
                      borderRadius: 10,
                      border:
                        "1px solid rgba(251,146,60,0.36)",
                      background: "rgba(154,52,18,0.18)",
                      color: "#ffedd5",
                      textAlign: "center",
                      fontWeight: 950,
                    }}
                  >
                    {team}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <div
                style={{
                  marginBottom: 9,
                  fontSize: 13,
                  fontWeight: 950,
                  letterSpacing: 0.4,
                  textTransform: "uppercase",
                  opacity: 0.58,
                }}
              >
                Teams used
              </div>

              {entry.used.length ? (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  {entry.used.map((team) => (
                    <span
                      key={`${entry.key}-used-${team}`}
                      style={{
                        padding: "7px 10px",
                        borderRadius: 9,
                        border:
                          "1px solid rgba(255,255,255,0.12)",
                        background: "rgba(255,255,255,0.045)",
                        color: "rgba(255,255,255,0.6)",
                        fontWeight: 850,
                        textDecoration: "line-through",
                      }}
                    >
                      {team}
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ opacity: 0.55, fontSize: 14 }}>
                  No teams used yet.
                </div>
              )}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
