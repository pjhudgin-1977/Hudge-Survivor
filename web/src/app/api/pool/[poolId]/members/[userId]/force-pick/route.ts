import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

export async function POST(
  req: Request,
  ctx: {
    params:
      | { poolId: string; userId: string }
      | Promise<{ poolId: string; userId: string }>;
  }
) {
  const supabase = await createClient();
  const { poolId, userId } = await Promise.resolve(ctx.params);

  if (!poolId || !userId || !isUuid(poolId) || !isUuid(userId)) {
    return NextResponse.json({ error: "Invalid pool or user id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const team = String(body?.team ?? "").trim().toUpperCase();

  if (!team) {
    return NextResponse.json({ error: "Missing team" }, { status: 400 });
  }

  // Must be logged in
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Must be commissioner
  const { data: isComm, error: commErr } = await supabase.rpc(
    "is_pool_commissioner",
    { pid: poolId }
  );
  if (commErr) {
    return NextResponse.json({ error: commErr.message }, { status: 500 });
  }
  if (!isComm) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Determine current week (next upcoming game)
  const nowIso = new Date().toISOString();
  const { data: nextGame, error: gameErr } = await supabase
    .from("games")
    .select("week_number, phase, kickoff_at")
    .gte("kickoff_at", nowIso)
    .order("kickoff_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (gameErr || !nextGame) {
    return NextResponse.json({ error: "Could not determine current week" }, { status: 500 });
  }

  const { week_number, phase } = nextGame;

  // 1) Check if a pick already exists for this member/week/phase
  const { data: existing, error: findErr } = await supabase
    .from("picks")
    .select("id")
    .eq("pool_id", poolId)
    .eq("user_id", userId)
    .eq("week_number", week_number)
    .eq("phase", phase)
    .maybeSingle();

  if (findErr) {
    return NextResponse.json({ error: `Find pick failed: ${findErr.message}` }, { status: 500 });
  }

  const now = new Date().toISOString();

  // 2) If exists → update it
  if (existing?.id) {
    const { error: updErr } = await supabase
      .from("picks")
      .update({
        picked_team: team,
        was_autopick: false,
        locked: false,
        submitted_at: now,
      })
      .eq("id", existing.id);

    if (updErr) {
      return NextResponse.json({ error: `Update failed: ${updErr.message}` }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      action: "updated",
      week_number,
      phase,
      picked_team: team,
    });
  }

  // 3) Otherwise → insert new pick
  const { error: insErr } = await supabase.from("picks").insert({
    pool_id: poolId,
    user_id: userId,
    week_number,
    phase,
    picked_team: team,
    was_autopick: false,
    locked: false,
    submitted_at: now,
  });

  if (insErr) {
    return NextResponse.json({ error: `Insert failed: ${insErr.message}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    action: "inserted",
    week_number,
    phase,
    picked_team: team,
  });
}