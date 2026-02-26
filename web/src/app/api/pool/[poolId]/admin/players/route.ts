import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ poolId: string }> }
) {
  const supabase = await createClient();
  const { poolId } = await params;

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const body = await req.json();

  // ✅ We update a pool member row by (pool_id, user_id)
  const target_user_id = String(body.user_id || "");
  const entry_fee_paid = !!body.entry_fee_paid;

  const entry_fee_amount =
    body.entry_fee_amount === null || body.entry_fee_amount === undefined
      ? null
      : Number(body.entry_fee_amount);

  if (!target_user_id) {
    return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
  }

  // Simple guard: requester must be a member of this pool
  const { data: me } = await supabase
    .from("pool_members")
    .select("user_id")
    .eq("pool_id", poolId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!me) {
    return NextResponse.json(
      { error: "Not a member of this pool" },
      { status: 403 }
    );
  }

  const { error } = await supabase
    .from("pool_members")
    .update({
      entry_fee_paid,
      entry_fee_amount,
      entry_fee_paid_at: entry_fee_paid ? new Date().toISOString() : null,
    })
    .eq("pool_id", poolId)
    .eq("user_id", target_user_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}