import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ poolId: string }> }
) {
  try {
    const { poolId } = await params;
    const supabase = await createClient();

    const { data: auth, error: authError } =
      await supabase.auth.getUser();

    if (authError || !auth.user) {
      return NextResponse.json(
        { error: "Not logged in" },
        { status: 401 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error("Missing Supabase admin configuration");
    }

    const admin = createAdminClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: memberships, error: membershipError } =
      await admin
        .from("pool_members")
        .select("is_commissioner, role")
        .eq("pool_id", poolId)
        .eq("user_id", auth.user.id);

    if (membershipError) {
      throw new Error(membershipError.message);
    }

    const isCommissioner = (memberships ?? []).some(
      (row) =>
        Boolean(row.is_commissioner) ||
        ["commissioner", "admin"].includes(
          String(row.role ?? "").toLowerCase()
        )
    );

    if (!isCommissioner) {
      return NextResponse.json(
        { error: "Commissioner access required" },
        { status: 403 }
      );
    }

    const { data: state, error: stateError } = await admin
      .from("pool_state")
      .select("season_year, week_type, week_number, picks_locked")
      .eq("pool_id", poolId)
      .single();

    if (stateError) throw new Error(stateError.message);

    const { data: existing, error: archiveError } = await admin
      .from("season_archives")
      .select("season_year, archived_at")
      .eq("pool_id", poolId)
      .eq("season_year", state.season_year)
      .maybeSingle();

    if (archiveError) throw new Error(archiveError.message);

    const [membersResult, gamesResult, picksResult] =
      await Promise.all([
        admin.from("pool_members")
          .select("losses, eliminated, is_eliminated")
          .eq("pool_id", poolId),

        admin.from("games")
          .select("week_number, phase, status")
          .eq("season_year", state.season_year),

        admin.from("picks")
          .select("id", { count: "exact", head: true })
          .eq("pool_id", poolId)
          .eq("result", "pending"),
      ]);

    if (membersResult.error) throw new Error(membersResult.error.message);
    if (gamesResult.error) throw new Error(gamesResult.error.message);
    if (picksResult.error) throw new Error(picksResult.error.message);

    const currentWeek = Number(state.week_number);
    const currentPhase =
      String(state.week_type).toUpperCase() === "REG"
        ? "regular"
        : "playoffs";

    const relevantGames = (gamesResult.data ?? []).filter((game) => {
      const phase = String(game.phase).toLowerCase();
      const week = Number(game.week_number);

      return currentPhase === "regular"
        ? phase === "regular" && week <= currentWeek
        : phase === "regular" ||
            (phase === "playoffs" && week <= currentWeek);
    });

    const unfinishedGames = relevantGames.filter(
      (game) => String(game.status).toLowerCase() !== "final"
    ).length;

    const remainingEntries = (membersResult.data ?? []).filter(
      (member) =>
        !member.eliminated &&
        !member.is_eliminated &&
        Number(member.losses ?? 0) < 2
    ).length;

    const pendingPicks = picksResult.count ?? 0;

    const reachedFinalPlayoffWeek =
      currentPhase === "playoffs" && currentWeek === 4;

    const poolEnded =
      remainingEntries <= 1 || reachedFinalPlayoffWeek;

    const blockers: string[] = [];

    if (existing) {
      blockers.push("This season has already been archived.");
    }

    if (!poolEnded) {
      blockers.push(
        "The Survivor Pool is still active with multiple surviving entries."
      );
    }

    if (relevantGames.length === 0) {
      blockers.push("No games found for the current season period.");
    }

    if (!state.picks_locked) {
      blockers.push("Current week's picks are not locked.");
    }

    if (unfinishedGames > 0) {
      blockers.push(`${unfinishedGames} relevant NFL games are unfinished.`);
    }

    if (pendingPicks > 0) {
      blockers.push(`${pendingPicks} player picks are pending.`);
    }

    return NextResponse.json({
      ok: true,
      seasonYear: state.season_year,
      currentWeek: state.week_number,
      weekType: state.week_type,
      picksLocked: state.picks_locked,
      alreadyArchived: Boolean(existing),
      remainingEntries,
      poolEnded,
      unfinishedGames,
      pendingPicks,
      blockers,
      seasonChecksPassed: blockers.length === 0,
      readyToArchive: false,
      message: "Read-only verification. Archiving is not enabled.",
    });
  } catch (error) {
    console.error("Season archive verification failed:", error);

    return NextResponse.json(
      { error: "Unable to verify season archive status" },
      { status: 500 }
    );
  }
}
