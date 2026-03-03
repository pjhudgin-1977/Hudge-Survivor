import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

export async function POST(
  req: Request,
  context: { params: Promise<{ poolId: string; userId: string }> }
) {
  const supabase = await createClient();
  const { poolId, userId } = await context.params;

  if (!poolId || !userId || !isUuid(poolId) || !isUuid(userId)) {
    return NextResponse.json(
      { error: "Invalid poolId or userId" },
      { status: 400 }
    );
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
    return NextResponse.json(
      { error: `Commissioner check failed: ${commErr.message}` },
      { status: 500 }
    );
  }
  if (!isComm) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Force pick via DB (preferred)
  const { data, error } = await supabase.rpc("force_pick_for_member", {
    p_pool_id: poolId,
    p_user_id: userId,
    p_team: team,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data ?? { ok: true });
}