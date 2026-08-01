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
  const adminSupabase = getAdminSupabase();
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
    if (fullName.length < 2) {
      return NextResponse.json(
        { error: "Your name must be at least 2 characters." },
        { status: 400 }
      );
    }

    if (fullName.length > 100) {
      return NextResponse.json(
        { error: "Your name must be 100 characters or fewer." },
        { status: 400 }
      );
    }

    const { data: targetAuthUser, error: authUserError } =
      await adminSupabase.auth.admin.getUserById(targetUserId);

    if (authUserError || !targetAuthUser?.user) {
      return NextResponse.json(
        { error: authUserError?.message || "User account not found" },
        { status: 400 }
      );
    }

    const { error: profileUpsertError } = await adminSupabase
      .from("profiles")
      .upsert(
        {
          user_id: targetUserId,
          full_name: fullName,
          email: targetAuthUser.user.email || null,
        },
        {
          onConflict: "user_id",
        }
      );

    if (profileUpsertError) {
      return NextResponse.json(
        { error: profileUpsertError.message },
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
  const removeMember = body.remove_member === true;
  const targetEntryNo = Number(body.entry_no);

  if (!targetUserId) {
    return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
  }

  if (
    !removeMember &&
    (!Number.isInteger(targetEntryNo) || targetEntryNo < 1)
  ) {
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
      {
        error: removeMember
          ? "Only commissioners can remove members"
          : "Only commissioners can remove entries",
      },
      { status: 403 }
    );
  }

  let targetQuery = adminSupabase
    .from("pool_members")
    .select("user_id, entry_no, screen_name, is_commissioner, role")
    .eq("pool_id", poolId)
    .eq("user_id", targetUserId);

  if (!removeMember) {
    targetQuery = targetQuery.eq("entry_no", targetEntryNo);
  }

  const { data: targetRows, error: targetError } = await targetQuery;

  if (targetError) {
    return NextResponse.json({ error: targetError.message }, { status: 400 });
  }

  if (!targetRows || targetRows.length === 0) {
    return NextResponse.json(
      { error: removeMember ? "Member not found" : "Entry not found" },
      { status: 404 }
    );
  }

  const targetIsCommissioner = targetRows.some(
    (row) =>
      Boolean(row.is_commissioner) ||
      String(row.role ?? "").toLowerCase() === "commissioner"
  );

  if (targetIsCommissioner) {
    return NextResponse.json(
      {
        error: removeMember
          ? "The commissioner cannot be removed from the pool"
          : "The commissioner entry cannot be removed",
      },
      { status: 400 }
    );
  }

  let picksDelete = adminSupabase
    .from("picks")
    .delete()
    .eq("pool_id", poolId)
    .eq("user_id", targetUserId);

  if (!removeMember) {
    picksDelete = picksDelete.eq("entry_no", targetEntryNo);
  }

  const { error: picksError } = await picksDelete;

  if (picksError) {
    return NextResponse.json({ error: picksError.message }, { status: 400 });
  }

  let usedTeamsDelete = adminSupabase
    .from("used_teams")
    .delete()
    .eq("pool_id", poolId)
    .eq("user_id", targetUserId);

  if (!removeMember) {
    usedTeamsDelete = usedTeamsDelete.eq("entry_no", targetEntryNo);
  }

  const { error: usedTeamsError } = await usedTeamsDelete;

  if (usedTeamsError) {
    return NextResponse.json(
      { error: usedTeamsError.message },
      { status: 400 }
    );
  }

  let memberDelete = adminSupabase
    .from("pool_members")
    .delete()
    .eq("pool_id", poolId)
    .eq("user_id", targetUserId);

  if (!removeMember) {
    memberDelete = memberDelete.eq("entry_no", targetEntryNo);
  }

  const { error: memberError } = await memberDelete;

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 400 });
  }

  if (removeMember) {
    return NextResponse.json({
      ok: true,
      removed_member: {
        user_id: targetUserId,
        entry_count: targetRows.length,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    removed: {
      screen_name: targetRows[0]?.screen_name ?? null,
      entry_no: targetEntryNo,
    },
  });
}
