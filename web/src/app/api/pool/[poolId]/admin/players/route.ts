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
    body.screen_name === undefined
      ? undefined
      : String(body.screen_name || "").trim();

  const fullName =
    body.full_name === undefined
      ? undefined
      : String(body.full_name || "").trim();

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
    return NextResponse.json(
      { error: "Player row not found" },
      { status: 404 }
    );
  }

  const poolMemberUpdate: Record<string, any> = {};

  if (screenName !== undefined) {
    poolMemberUpdate.screen_name = screenName || null;
  }

  if (entryFeePaid !== undefined) {
    poolMemberUpdate.entry_fee_paid = entryFeePaid;
    poolMemberUpdate.entry_fee_paid_at = entryFeePaid
      ? new Date().toISOString()
      : null;
  }

  if (entryFeeAmount !== undefined) {
    if (entryFeeAmount !== null && !Number.isFinite(entryFeeAmount)) {
      return NextResponse.json(
        { error: "Invalid entry fee amount" },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: poolMemberError.message },
        { status: 400 }
      );
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

export async function PATCH(
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
  const newTeam = String(body.picked_team || "").trim().toUpperCase();
  const reason = String(body.reason || "").trim();

  if (!targetUserId) {
    return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
  }

  if (!Number.isInteger(targetEntryNo) || targetEntryNo < 1) {
    return NextResponse.json({ error: "Invalid entry_no" }, { status: 400 });
  }

  if (!newTeam) {
    return NextResponse.json({ error: "Missing picked_team" }, { status: 400 });
  }

  if (reason.length < 3) {
    return NextResponse.json(
      { error: "Commissioner override reason is required" },
      { status: 400 }
    );
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
      { error: "Only commissioners can override picks" },
      { status: 403 }
    );
  }

  const { data: targetMember, error: targetMemberError } = await adminSupabase
    .from("pool_members")
    .select("user_id, entry_no, autopicks_used")
    .eq("pool_id", poolId)
    .eq("user_id", targetUserId)
    .eq("entry_no", targetEntryNo)
    .maybeSingle();

  if (targetMemberError || !targetMember) {
    return NextResponse.json(
      { error: targetMemberError?.message || "Player entry not found" },
      { status: 404 }
    );
  }

  const { data: poolState, error: poolStateError } = await adminSupabase
    .from("pool_state")
    .select("season_year, week_number, week_type")
    .eq("pool_id", poolId)
    .maybeSingle();

  if (poolStateError || !poolState) {
    return NextResponse.json(
      { error: poolStateError?.message || "Pool state not found" },
      { status: 400 }
    );
  }

  const currentPhase =
    String(poolState.week_type ?? "").toUpperCase() === "REG"
      ? "regular"
      : "playoffs";

  const { data: game, error: gameError } = await adminSupabase
    .from("games")
    .select("home_team, away_team")
    .eq("season_year", poolState.season_year)
    .eq("week_number", poolState.week_number)
    .eq("phase", currentPhase)
    .or(`home_team.eq.${newTeam},away_team.eq.${newTeam}`)
    .maybeSingle();

  if (gameError || !game) {
    return NextResponse.json(
      {
        error:
          gameError?.message || "Selected team is not valid for this week",
      },
      { status: 400 }
    );
  }

  const { data: existingPick, error: existingPickError } = await adminSupabase
    .from("picks")
    .select("id, picked_team, was_autopick")
    .eq("pool_id", poolId)
    .eq("user_id", targetUserId)
    .eq("entry_no", targetEntryNo)
    .eq("week_number", poolState.week_number)
    .eq("phase", currentPhase)
    .maybeSingle();

  if (existingPickError) {
    return NextResponse.json(
      { error: existingPickError.message },
      { status: 400 }
    );
  }

  const { data: duplicateTeam, error: duplicateTeamError } =
    await adminSupabase
      .from("picks")
      .select("id")
      .eq("pool_id", poolId)
      .eq("user_id", targetUserId)
      .eq("entry_no", targetEntryNo)
      .eq("week_type", poolState.week_type)
      .eq("picked_team", newTeam)
      .neq("week_number", poolState.week_number)
      .maybeSingle();

  if (duplicateTeamError) {
    return NextResponse.json(
      { error: duplicateTeamError.message },
      { status: 400 }
    );
  }

  if (duplicateTeam) {
    return NextResponse.json(
      { error: `${newTeam} has already been used by this entry` },
      { status: 400 }
    );
  }

  const oldTeam = existingPick?.picked_team ?? null;
  const replacedAutopick = existingPick?.was_autopick === true;

  if (oldTeam && oldTeam !== newTeam) {
    const { error: deleteUsedTeamError } = await adminSupabase
      .from("used_teams")
      .delete()
      .eq("pool_id", poolId)
      .eq("user_id", targetUserId)
      .eq("entry_no", targetEntryNo)
      .eq("team_abbr", oldTeam)
      .eq("phase", currentPhase);

    if (deleteUsedTeamError) {
      return NextResponse.json(
        { error: deleteUsedTeamError.message },
        { status: 400 }
      );
    }
  }

  const { error: usedTeamError } = await adminSupabase
    .from("used_teams")
    .upsert(
      {
        pool_id: poolId,
        user_id: targetUserId,
        entry_no: targetEntryNo,
        team_abbr: newTeam,
        phase: currentPhase,
        used_at: new Date().toISOString(),
      },
      {
        onConflict: "pool_id,user_id,entry_no,team_abbr,phase",
      }
    );

  if (usedTeamError) {
    return NextResponse.json(
      { error: usedTeamError.message },
      { status: 400 }
    );
  }

  if (existingPick) {
    const { error: pickUpdateError } = await adminSupabase
      .from("picks")
      .update({
        picked_team: newTeam,
        submitted_at: new Date().toISOString(),
        locked: true,
        result: "pending",
        counted_in_losses: false,
        was_autopick: false,
      })
      .eq("id", existingPick.id);

    if (pickUpdateError) {
      return NextResponse.json(
        { error: pickUpdateError.message },
        { status: 400 }
      );
    }
  } else {
    const { error: pickInsertError } = await adminSupabase
      .from("picks")
      .insert({
        pool_id: poolId,
        user_id: targetUserId,
        entry_no: targetEntryNo,
        week_number: poolState.week_number,
        phase: currentPhase,
        week_type: poolState.week_type,
        picked_team: newTeam,
        submitted_at: new Date().toISOString(),
        locked: true,
        result: "pending",
        counted_in_losses: false,
        was_autopick: false,
      });

    if (pickInsertError) {
      return NextResponse.json(
        { error: pickInsertError.message },
        { status: 400 }
      );
    }
  }

  if (replacedAutopick) {
    const currentAutopicks = Number(targetMember.autopicks_used || 0);

    const { error: autopickError } = await adminSupabase
      .from("pool_members")
      .update({
        autopicks_used: Math.max(0, currentAutopicks - 1),
      })
      .eq("pool_id", poolId)
      .eq("user_id", targetUserId)
      .eq("entry_no", targetEntryNo);

    if (autopickError) {
      return NextResponse.json(
        { error: autopickError.message },
        { status: 400 }
      );
    }
  }

  const { error: auditError } = await adminSupabase
    .from("commissioner_pick_overrides")
    .insert({
      pool_id: poolId,
      commissioner_user_id: userRes.user.id,
      target_user_id: targetUserId,
      entry_no: targetEntryNo,
      season_year: poolState.season_year,
      week_number: poolState.week_number,
      phase: String(currentPhase),
      week_type: poolState.week_type,
      old_team: oldTeam,
      new_team: newTeam,
      reason,
      replaced_autopick: replacedAutopick,
    });

  if (auditError) {
    return NextResponse.json(
      { error: auditError.message },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    old_team: oldTeam,
    new_team: newTeam,
    replaced_autopick: replacedAutopick,
  });
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
      Boolean(row.is_commissioner) ||
      String(row.role ?? "").toLowerCase() === "commissioner" ||
      String(row.role ?? "").toLowerCase() === "admin"
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
    return NextResponse.json(
      { error: targetError.message },
      { status: 400 }
    );
  }

  if (!targetRows || targetRows.length === 0) {
    return NextResponse.json(
      {
        error: removeMember ? "Member not found" : "Entry not found",
      },
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
    return NextResponse.json(
      { error: picksError.message },
      { status: 400 }
    );
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
    return NextResponse.json(
      { error: memberError.message },
      { status: 400 }
    );
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