import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Commissioner check (your DB RPC)
async function mustBeCommissioner(supabase: any, poolId: string) {
  const { data: isComm, error } = await supabase.rpc("is_pool_commissioner", {
    pid: poolId,
  });
  if (error) return { ok: false as const, status: 500, error: error.message };
  if (!isComm) return { ok: false as const, status: 403, error: "Not authorized" };
  return { ok: true as const };
}

export async function POST(
  _req: Request,
  context: { params: Promise<{ poolId: string }> }
) {
  const supabase = await createClient();

  // Must be logged in
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { poolId } = await context.params;

  // Must be commissioner for this pool
  const comm = await mustBeCommissioner(supabase, poolId);
  if (!comm.ok) {
    return NextResponse.json({ error: comm.error }, { status: comm.status });
  }

  // Trigger the pool-wide force autopick pass (DB handles who needs it)
  const { data, error } = await supabase.rpc("force_autopick_now", {
    p_pool_id: poolId,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message, hint: "Check DB function force_autopick_now(uuid)" },
      { status: 400 }
    );
  }

  return NextResponse.json(data ?? { ok: true });
}