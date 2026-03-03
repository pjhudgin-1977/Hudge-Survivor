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
    return NextResponse.json(
      {
        error: `Invalid params: poolId=${String(poolId)} userId=${String(
          userId
        )}`,
      },
      { status: 400 }
    );
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

  // Update: set autopicks_used = 0
  const { error: updErr } = await supabase
    .from("pool_members")
    .update({ autopicks_used: 0 })
    .eq("pool_id", poolId)
    .eq("user_id", userId);

  if (updErr) {
    return NextResponse.json(
      { error: `Update failed: ${updErr.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, autopicks_used: 0 });
}