import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createAdminClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

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

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ poolId: string }> }
) {
  const supabase = await createClient();
  const adminSupabase = getAdminSupabase();
  const { poolId } = await params;

  const { data: userRes } = await supabase.auth.getUser();

  if (!userRes?.user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const body = await req.json();

  const targetUserId = String(body.user_id || "");
  const targetEntryNo = Number(body.entry_no);

  if (!targetUserId) {
    return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
  }

  if (!Number.isInteger(targetEntryNo) || targetEntryNo < 1) {
    return NextResponse.json({ error: "Invalid entry_no" }, { status: 400 });
  }

  const { data: meRows, error: meError } = await adminSupabase
    .from("pool_members")
    .select("is_commissioner, role")
    .eq("pool_id", poolId)
    .eq("user_id", userRes.user.id);

  if (meError) {
    return NextResponse.json({ error: meError.message }, { status: 400 });
  }

  const isCommissioner = (meRows || []).some(
    (row) =>
      Boolean(row?.is_commissioner) ||
      String(row?.role ?? "").toLowerCase() === "commissioner" ||
      String(row?.role ?? "").toLowerCase() === "admin"
  );

  if (!isCommissioner) {
    return NextResponse.json(
      { error: "Only commissioners can remove entries" },
      { status: 403 }
    );
  }

  const { data: targetRow, error: targetError } = await adminSupabase
    .from("pool_members")
    .select("user_id, entry_no, screen_name, is_commissioner, role")
    .eq("pool_id", poolId)
    .eq("user_id", targetUserId)
    .eq("entry_no", targetEntryNo)
    .maybeSingle();

  if (targetError) {
    return NextResponse.json({ error: targetError.message }, { status: 400 });
  }

  if (!targetRow) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  const targetIsCommissioner =
    Boolean(targetRow.is_commissioner) ||
    String(targetRow.role ?? "").toLowerCase() === "commissioner";

  if (targetIsCommissioner) {
    return NextResponse.json(
      { error: "The commissioner entry cannot be removed" },
      { status: 400 }
    );
  }

  const { error: picksError } = await adminSupabase
    .from("picks")
    .delete()
    .eq("pool_id", poolId)
    .eq("user_id", targetUserId)
    .eq("entry_no", targetEntryNo);

  if (picksError) {
    return NextResponse.json({ error: picksError.message }, { status: 400 });
  }

  const { error: usedTeamsError } = await adminSupabase
    .from("used_teams")
    .delete()
    .eq("pool_id", poolId)
    .eq("user_id", targetUserId)
    .eq("entry_no", targetEntryNo);

  if (usedTeamsError) {
    return NextResponse.json({ error: usedTeamsError.message }, { status: 400 });
  }

  const { error: memberError } = await adminSupabase
    .from("pool_members")
    .delete()
    .eq("pool_id", poolId)
    .eq("user_id", targetUserId)
    .eq("entry_no", targetEntryNo);

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    removed: {
      screen_name: targetRow.screen_name,
      entry_no: targetEntryNo,
    },
  });
}
