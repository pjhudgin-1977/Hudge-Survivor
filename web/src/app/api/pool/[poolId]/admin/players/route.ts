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

  const targetUserId = String(body.user_id || "");
  const targetEntryNo = Number(body.entry_no || 1);

  const screenName =
    body.screen_name === undefined ? undefined : String(body.screen_name || "").trim();

  const fullName =
    body.full_name === undefined ? undefined : String(body.full_name || "").trim();

  const entryFeePaid =
    body.entry_fee_paid === undefined ? undefined : !!body.entry_fee_paid;

  const entryFeeAmount =
    body.entry_fee_amount === undefined
      ? undefined
      : body.entry_fee_amount === null || body.entry_fee_amount === ""
      ? null
      : Number(body.entry_fee_amount);

  if (!targetUserId) {
    return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
  }

  if (!Number.isFinite(targetEntryNo) || targetEntryNo < 1) {
    return NextResponse.json({ error: "Invalid entry_no" }, { status: 400 });
  }

  const { data: meRows } = await supabase
    .from("pool_members")
    .select("is_commissioner, role")
    .eq("pool_id", poolId)
    .eq("user_id", userRes.user.id);

  const isCommissioner = (meRows || []).some(
    (row) =>
      Boolean(row?.is_commissioner) ||
      String(row?.role ?? "").toLowerCase() === "commissioner" ||
      String(row?.role ?? "").toLowerCase() === "admin"
  );

  if (!isCommissioner) {
    return NextResponse.json(
      { error: "Only commissioners can edit players" },
      { status: 403 }
    );
  }

  const { data: targetRow } = await supabase
    .from("pool_members")
    .select("user_id, entry_no")
    .eq("pool_id", poolId)
    .eq("user_id", targetUserId)
    .eq("entry_no", targetEntryNo)
    .maybeSingle();

  if (!targetRow) {
    return NextResponse.json({ error: "Player row not found" }, { status: 404 });
  }

  const poolMemberUpdate: Record<string, any> = {};

  if (screenName !== undefined) {
    poolMemberUpdate.screen_name = screenName || null;
  }

  if (entryFeePaid !== undefined) {
    poolMemberUpdate.entry_fee_paid = entryFeePaid;
    poolMemberUpdate.entry_fee_paid_at = entryFeePaid ? new Date().toISOString() : null;
  }

  if (entryFeeAmount !== undefined) {
    if (entryFeeAmount !== null && !Number.isFinite(entryFeeAmount)) {
      return NextResponse.json({ error: "Invalid entry fee amount" }, { status: 400 });
    }
    poolMemberUpdate.entry_fee_amount = entryFeeAmount;
  }

  if (Object.keys(poolMemberUpdate).length > 0) {
    const { error: poolMemberError } = await supabase
      .from("pool_members")
      .update(poolMemberUpdate)
      .eq("pool_id", poolId)
      .eq("user_id", targetUserId)
      .eq("entry_no", targetEntryNo);

    if (poolMemberError) {
      return NextResponse.json({ error: poolMemberError.message }, { status: 400 });
    }
  }

     if (fullName !== undefined) {
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (!existingProfile) {
      return NextResponse.json(
        {
          error:
            "No profile row exists yet for this user. Full name can be edited after a profile row is created.",
        },
        { status: 400 }
      );
    }

    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName || null,
      })
      .eq("user_id", targetUserId);

    if (profileUpdateError) {
      return NextResponse.json(
        { error: profileUpdateError.message },
        { status: 400 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}