import { redirect } from "next/navigation";
import Link from "next/link";
import React from "react";
import { createClient } from "@/lib/supabase/server";
import WeekCountdownBanner from "@/app/_components/WeekCountdownBanner";

type PickRow = {
  week_type: string | null;
  week_number: number | null;
  picked_team: string | null;
};

type UsedTeamRow = {
  team: string | null;
  first_week_type: string | null;
  first_week_number: number | null;
};

function weekLabel(weekType: string | null, weekNumber: number | null) {
  const wt = String(weekType ?? "").toUpperCase();
  const wn = typeof weekNumber === "number" ? weekNumber : null;
  if (!wn) return "Week —";
  return wt === "REG" ? `Week ${wn}` : wt ? `Playoff W${wn}` : `Week ${wn}`;
}

export default async function PoolDashboardPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const supabase = await createClient();
  const { poolId } = await params;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login");

  const userId = auth.user.id;

  // ✅ Commissioner check (for showing Admin link)
  const { data: gate } = await supabase
    .from("pool_members")
    .select("is_commissioner")
    .eq("pool_id", poolId)
    .eq("user_id", userId)
    .maybeSingle();

  const isCommissioner = Boolean(gate?.is_commissioner);

  // ✅ Current week = NEXT upcoming game (fallback earliest)
  const nowIso = new Date().toISOString();

  const { data: nextGame } = await supabase
    .from("games")
    .select("week_type, week_number, kickoff_at")
    .gte("kickoff_at", nowIso)
    .order("kickoff_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: earliestGame } = await supabase
    .from("games")
    .select("week_type, week_number, kickoff_at")
    .order("kickoff_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const g = nextGame ?? earliestGame ?? null;

  const currentWeekType =
    g?.week_type && g.week_number != null ? String(g.week_type) : null;

  const currentWeekNumber =
    g?.week_number != null ? Number(g.week_number) : null;

  const currentWeekLabel =
    currentWeekNumber != null
      ? weekLabel(currentWeekType, currentWeekNumber)
      : "Week —";

  // Picks (latest week first)
  const { data: picks, error: picksErr } = await supabase
    .from("picks")
    .select("week_type, week_number, picked_team")
    .eq("pool_id", poolId)
    .eq("user_id", userId)
    .order("week_number", { ascending: false })
    .order("week_type", { ascending: false })
    .limit(30);

  const picksList = (picks ?? []) as PickRow[];

  // Find this user's pick for current week
  const thisWeekPick =
    currentWeekNumber != null
      ? picksList.find((p) => Number(p.week_number ?? -1) === currentWeekNumber)
      : null;

  const actionText = thisWeekPick ? "Change Pick" : "Make Pick";

  // ✅ Used teams (derived from picks via view)
  const { data: usedTeams, error: usedErr } = await supabase
    .from("v_used_teams")
    .select("team, first_week_type, first_week_number")
    .eq("pool_id", poolId)
    .eq("user_id", userId)
    .order("first_week_number", { ascending: true });

  const usedList = (usedTeams ?? []) as UsedTeamRow[];

  return (
    <main style={{ padding: 24, display: "grid", gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Pool Dashboard</h1>
        <p style={{ marginTop: 6, opacity: 0.75 }}>
          Pool: <strong>{poolId}</strong>
        </p>
        <p style={{ marginTop: 6, opacity: 0.75 }}>
          Current: <strong>{currentWeekLabel}</strong>
        </p>
      </div>

      <WeekCountdownBanner poolId={poolId} />

      {/* ✅ This Week box */}
      <div
        style={{
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 12,
          padding: 14,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 14, opacity: 0.75 }}>This Week</div>
          <div style={{ marginTop: 4, fontSize: 18, fontWeight: 900 }}>
            {currentWeekLabel}
          </div>

          <div style={{ marginTop: 6, opacity: 0.85 }}>
            {thisWeekPick ? (
              <>
                ✅ You picked: <strong>{thisWeekPick.picked_team ?? "—"}</strong>
              </>
            ) : (
              <>⚠️ No pick submitted yet</>
            )}
          </div>
        </div>

        <Link
          href={`/pool/${poolId}/pick`}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.18)",
            textDecoration: "none",
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          {actionText}
        </Link>
      </div>

      {/* ✅ Used Teams box */}
      <div
        style={{
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 12,
          padding: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
            Used Teams
          </h2>
          <span style={{ opacity: 0.75, fontSize: 13 }}>
            {usedList.length} used
          </span>
        </div>

        {usedErr ? (
          <p style={{ marginTop: 10, color: "crimson" }}>
            Could not load used teams: {usedErr.message}
          </p>
        ) : usedList.length === 0 ? (
          <div style={{ marginTop: 10, opacity: 0.75 }}>
            None yet — once you submit picks, your used teams will show up here.
          </div>
        ) : (
          <div
            style={{
              marginTop: 12,
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            {usedList
              .filter((r) => r.team)
              .map((r, idx) => (
                <span
                  key={`${r.team}-${idx}`}
                  title={`First used: ${weekLabel(
                    r.first_week_type,
                    r.first_week_number
                  )}`}
                  style={{
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: "1px solid rgba(0,0,0,0.18)",
                    background: "rgba(0,0,0,0.04)",
                    fontWeight: 700,
                  }}
                >
                  {r.team}
                </span>
              ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link
          href={`/pool/${poolId}/pick`}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.18)",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          Make / Change Pick
        </Link>

        <Link
          href={`/pool/${poolId}/sweat`}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.18)",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          Sweat Board
        </Link>

        <Link
          href={`/pool/${poolId}/standings`}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.18)",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          Standings
        </Link>

        {isCommissioner ? (
          <Link
            href={`/pool/${poolId}/admin`}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.18)",
              textDecoration: "none",
              fontWeight: 900,
            }}
          >
            🛠 Admin
          </Link>
        ) : null}
      </div>

      {/* My Picks */}
      <div
        style={{
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 12,
          padding: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>My Picks</h2>
          <span style={{ opacity: 0.75, fontSize: 13 }}>Latest week first</span>
        </div>

        {picksErr ? (
          <p style={{ marginTop: 10, color: "crimson" }}>
            Could not load picks: {picksErr.message}
          </p>
        ) : picksList.length === 0 ? (
          <div style={{ marginTop: 10, opacity: 0.75 }}>
            No picks yet. Click <strong>Make / Change Pick</strong> to submit your first pick.
          </div>
        ) : (
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {picksList.slice(0, 10).map((p, idx) => (
              <div
                key={`${p.week_type}-${p.week_number}-${idx}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 10,
                  padding: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 800 }}>
                    {weekLabel(p.week_type, p.week_number)}
                  </div>
                  <div style={{ marginTop: 4, opacity: 0.85 }}>
                    Pick: <strong>{p.picked_team ?? "—"}</strong>
                  </div>
                </div>

                <Link
                  href={`/pool/${poolId}/pick`}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.18)",
                    textDecoration: "none",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  Edit
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}