import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

export async function POST(
  _req: Request,
  context: { params: Promise<{ poolId: string; userId: string }> }
) {
  const supabase = await createClient();

  const { poolId, userId } = await context.params;

  // ✅ Hard guard so we never call RPC with missing args
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

  // 1) Must be logged in
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // 2) Must be commissioner
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

  // 3) Read current value
  const { data: row, error: readErr } = await supabase
    .from("pool_members")
    .select("entry_fee_paid")
    .eq("pool_id", poolId)
    .eq("user_id", userId)
    .maybeSingle();

  if (readErr) {
    return NextResponse.json(
      { error: `Read failed: ${readErr.message}` },
      { status: 500 }
    );
  }

  if (!row) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const nextPaid = !Boolean(row.entry_fee_paid);

  // 4) Update
  const { error: updErr } = await supabase
    .from("pool_members")
    .update({ entry_fee_paid: nextPaid })
    .eq("pool_id", poolId)
    .eq("user_id", userId);

  if (updErr) {
    return NextResponse.json(
      { error: `Update failed: ${updErr.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, entry_fee_paid: nextPaid });
}