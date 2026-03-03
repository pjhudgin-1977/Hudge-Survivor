import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Standings2Client from "./Standings2Client";

type MemberRow = {
  user_id: string;
  screen_name: string | null;
  entry_fee_paid: boolean | null;
  autopicks_used: number | null;

  // NEW (Latest Pick fields)
  latest_pick_team?: string | null;
  latest_pick_week?: number | null;
  latest_pick_phase?: string | null;
  latest_pick_result?: string | null;
  latest_pick_locked?: boolean | null;
  latest_pick_was_autopick?: boolean | null;
};

type PickRow = {
  user_id: string;
  week_number: number;
  phase: string;
  picked_team: string | null;
  was_autopick: boolean | null;
  result: string | null;
  locked: boolean | null;
  submitted_at: string | null;
};

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

export default async function Standings2Page({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const supabase = await createClient();

  const { poolId } = await params;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login");

  if (!poolId || !isUuid(poolId)) {
    return (
      <div style={{ padding: 24, color: "white" }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>Standings2</div>
        <div style={{ marginTop: 10, opacity: 0.8 }}>
          Invalid poolId in URL: <code>{String(poolId)}</code>
        </div>
      </div>
    );
  }

  const { data: comm, error: commErr } = await supabase.rpc(
    "is_pool_commissioner",
    { pid: poolId }
  );
  if (commErr) {
    return (
      <div style={{ padding: 24, color: "white" }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>Standings2</div>
        <div style={{ marginTop: 10, opacity: 0.8 }}>
          Commissioner check failed: {commErr.message}
        </div>
      </div>
    );
  }
  const isCommissioner = !!comm;

  // 1) Load members (RLS-safe: pool member rows should be visible in your policies)
  const { data: members, error } = await supabase
    .from("pool_members")
    .select("user_id, screen_name, entry_fee_paid, autopicks_used")
    .eq("pool_id", poolId)
    .order("screen_name", { ascending: true });

  if (error) {
    return (
      <div style={{ padding: 24, color: "white" }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>Standings2</div>
        <div style={{ marginTop: 10, opacity: 0.8 }}>
          Error loading pool members: {error.message}
        </div>
      </div>
    );
  }

  const baseRows = (members ?? []) as MemberRow[];

  // 2) Determine “current week/phase” from the next upcoming game (fallback: latest game)
  const nowIso = new Date().toISOString();

  let currentWeekNumber: number | null = null;
  let currentPhase: string | null = null;

  const { data: nextGame, error: nextErr } = await supabase
    .from("games")
    .select("week_number, phase, kickoff_at")
    .eq("pool_id", poolId)
    .gte("kickoff_at", nowIso)
    .order("kickoff_at", { ascending: true })
    .limit(1);

  if (!nextErr && nextGame && nextGame.length > 0) {
    currentWeekNumber = nextGame[0].week_number ?? null;
    currentPhase = (nextGame[0].phase as any) ?? null;
  } else {
    const { data: lastGame, error: lastErr } = await supabase
      .from("games")
      .select("week_number, phase, kickoff_at")
      .eq("pool_id", poolId)
      .order("kickoff_at", { ascending: false })
      .limit(1);

    if (!lastErr && lastGame && lastGame.length > 0) {
      currentWeekNumber = lastGame[0].week_number ?? null;
      currentPhase = (lastGame[0].phase as any) ?? null;
    }
  }

  // 3) Load picks needed to compute “Latest Pick”
  //    Rule: prefer current week pick if exists; else use most recently submitted pick.
  let currentWeekPickMap = new Map<string, PickRow>();
  if (currentWeekNumber != null && currentPhase) {
    const { data: curPicks, error: curErr } = await supabase
      .from("picks")
      .select(
        "user_id, week_number, phase, picked_team, was_autopick, result, locked, submitted_at"
      )
      .eq("pool_id", poolId)
      .eq("week_number", currentWeekNumber)
      .eq("phase", currentPhase);

    if (!curErr && curPicks) {
      for (const p of curPicks as PickRow[]) {
        currentWeekPickMap.set(p.user_id, p);
      }
    }
  }

  // Pull recent picks for pool and pick the first per user (submitted_at desc)
  // NOTE: This is simple + reliable for typical pool sizes.
  const { data: recentPicks, error: recentErr } = await supabase
    .from("picks")
    .select(
      "user_id, week_number, phase, picked_team, was_autopick, result, locked, submitted_at"
    )
    .eq("pool_id", poolId)
    .order("submitted_at", { ascending: false })
    .limit(5000);

  const latestPickMap = new Map<string, PickRow>();
  if (!recentErr && recentPicks) {
    for (const p of recentPicks as PickRow[]) {
      if (!latestPickMap.has(p.user_id)) {
        latestPickMap.set(p.user_id, p);
      }
    }
  }

  // 4) Build final rows with latest pick fields
  const rows: MemberRow[] = baseRows.map((m) => {
    const preferred =
      currentWeekPickMap.get(m.user_id) ?? latestPickMap.get(m.user_id);

    return {
      ...m,
      latest_pick_team: preferred?.picked_team ?? null,
      latest_pick_week: preferred?.week_number ?? null,
      latest_pick_phase: preferred?.phase ?? null,
      latest_pick_result: preferred?.result ?? null,
      latest_pick_locked: preferred?.locked ?? null,
      latest_pick_was_autopick: preferred?.was_autopick ?? null,
    };
  });

  return (
    <Standings2Client
      poolId={poolId}
      isCommissioner={isCommissioner}
      rows={rows}
    />
  );
}