import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Commissioner check (your DB RPC)
async function mustBeCommissioner(supabase: any, poolId: string) {
  const { data: isComm, error } = await supabase.rpc("is_pool_commissioner", {
    pid: poolId,
  });
  if (error) {
    return { ok: false as const, status: 500, error: error.message };
  }
  if (!isComm) {
    return { ok: false as const, status: 403, error: "Not authorized" };
  }
  return { ok: true as const };
}

export async function POST(
  req: Request,
  context: { params: Promise<{ poolId: string; userId: string }> }
) {
  const supabase = await createClient();

  // Must be logged in
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { poolId, userId } = await context.params;

  // Must be commissioner for this pool
  const comm = await mustBeCommissioner(supabase, poolId);
  if (!comm.ok) {
    return NextResponse.json({ error: comm.error }, { status: comm.status });
  }

  // Body: { team: "CHI" }
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const teamRaw = body?.team;
  const team = teamRaw ? String(teamRaw).toUpperCase().trim() : "";
  if (!team) {
    return NextResponse.json({ error: "Missing team" }, { status: 400 });
  }

  // Insert/Upsert pick for that user for the CURRENT week (your DB handles rules/locking)
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