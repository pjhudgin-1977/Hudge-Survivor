import Link from "next/link";
import PayoutEditor from "./PayoutEditor";
import {
  calculateFinishingPositions,
  type RankingPick,
} from "./rankings";
import { redirect } from "next/navigation";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export default async function SeasonArchiveAdminPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const { poolId } = await params;
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    redirect(`/login?next=/pool/${poolId}/admin/season-archive`);
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

  const { data: commissionerRows, error: commissionerError } = await admin
    .from("pool_members")
    .select("is_commissioner, role")
    .eq("pool_id", poolId)
    .eq("user_id", auth.user.id);

  const isCommissioner = (commissionerRows ?? []).some(
    (row) =>
      Boolean(row.is_commissioner) ||
      ["commissioner", "admin"].includes(
        String(row.role ?? "").toLowerCase()
      )
  );

  if (commissionerError || !isCommissioner) {
    redirect(`/pool/${poolId}`);
  }

  const [stateResult, membersResult] = await Promise.all([
    admin
      .from("pool_state")
      .select("season_year, week_type, week_number, picks_locked")
      .eq("pool_id", poolId)
      .maybeSingle(),
    admin
      .from("pool_members")
      .select(
        "user_id, entry_no, screen_name, losses, is_eliminated, entry_fee_paid, entry_fee_amount"
      )
      .eq("pool_id", poolId)
      .order("screen_name", { ascending: true })
      .order("entry_no", { ascending: true }),
  ]);

  if (stateResult.error) throw new Error(stateResult.error.message);
  if (membersResult.error) throw new Error(membersResult.error.message);

  const year = Number(stateResult.data?.season_year ?? 2026);
  const members = membersResult.data ?? [];
  const userIds = [...new Set(members.map((m) => m.user_id))];

  const { data: profiles, error: profilesError } = userIds.length
    ? await admin
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds)
    : { data: [], error: null };

  if (profilesError) throw new Error(profilesError.message);

  const names = new Map(
    (profiles ?? []).map((p) => [p.user_id, p.full_name])
  );

  const paid = members.filter((m) => m.entry_fee_paid);

  const missingAmounts = paid.filter(
    (m) =>
      m.entry_fee_amount === null ||
      m.entry_fee_amount === undefined ||
      m.entry_fee_amount === "" ||
      !Number.isFinite(Number(m.entry_fee_amount)) ||
      Number(m.entry_fee_amount) < 0
  );

  const collectedCents = paid.reduce((total, m) => {
    const amount = Number(m.entry_fee_amount);
    if (
      m.entry_fee_amount === null ||
      m.entry_fee_amount === undefined ||
      m.entry_fee_amount === "" ||
      !Number.isFinite(amount) ||
      amount < 0
    ) {
      return total;
    }
    return total + Math.round(amount * 100);
  }, 0);

  const hostingCents = paid.length * 100;
  const prizePoolCents = collectedCents - hostingCents;

  const [gamesCheck, picksCheck] = await Promise.all([
    admin.from("games")
      .select("status, phase, week_number")
      .eq("season_year", year),
    admin.from("picks")
      .select("id", { count: "exact", head: true })
      .eq("pool_id", poolId)
      .eq("result", "pending"),
  ]);

  if (gamesCheck.error) throw new Error(gamesCheck.error.message);
  if (picksCheck.error) throw new Error(picksCheck.error.message);

  const currentWeek = Number(stateResult.data?.week_number ?? 0);
  const currentPhase =
    String(stateResult.data?.week_type ?? "").toUpperCase() === "REG"
      ? "regular"
      : "playoffs";

  const relevantGames = (gamesCheck.data ?? []).filter((game) => {
    const phase = String(game.phase ?? "").toLowerCase();
    const week = Number(game.week_number);

    return currentPhase === "regular"
      ? phase === "regular" && week <= currentWeek
      : phase === "regular" ||
          (phase === "playoffs" && week <= currentWeek);
  });

  const unfinishedGames = relevantGames.filter(
    (game) => String(game.status ?? "").toLowerCase() !== "final"
  ).length;

  const futureGames = (gamesCheck.data ?? []).length - relevantGames.length;
  const pendingPicks = picksCheck.count ?? 0;
  const picksLocked = stateResult.data?.picks_locked === true;

  const allPicks: RankingPick[] = [];
  const batchSize = 500;

  for (let offset = 0; ; offset += batchSize) {
    const { data, error } = await admin
      .from("picks")
      .select(
        "user_id, entry_no, week_number, phase, result, counted_in_losses"
      )
      .eq("pool_id", poolId)
      .order("id", { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (error) throw new Error(error.message);

    allPicks.push(...((data ?? []) as RankingPick[]));

    if ((data ?? []).length < batchSize) break;
  }

  const rankings = calculateFinishingPositions(
    members.map((m) => ({
      user_id: String(m.user_id),
      entry_no: Number(m.entry_no),
      losses: Number(m.losses ?? 0),
      eliminated: Boolean(m.is_eliminated) || Number(m.losses ?? 0) >= 2,
    })),
    allPicks
  );

  const payoutEntries = members.map((m) => ({
    user_id: String(m.user_id),
    entry_no: Number(m.entry_no),
    name: String(names.get(m.user_id) || m.screen_name || "Unknown"),
    losses: Number(m.losses ?? 0),
    suggestedFinish:
      rankings.get(`${m.user_id}:${m.entry_no}`)?.finish ?? null,
    needsReview:
      rankings.get(`${m.user_id}:${m.entry_no}`)?.needsReview ?? true,
  })).sort((a, b) => {
    const aPlace = a.suggestedFinish ?? Number.MAX_SAFE_INTEGER;
    const bPlace = b.suggestedFinish ?? Number.MAX_SAFE_INTEGER;

    if (aPlace !== bPlace) return aPlace - bPlace;

    return a.name.localeCompare(b.name) ||
      a.entry_no - b.entry_no;
  });

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <Link href={`/pool/${poolId}/admin`}>
        Back to Commissioner Dashboard
      </Link>

      <h1 style={{ fontSize: 30, fontWeight: 900, marginTop: 24 }}>
        Season Archive — {year}
      </h1>

      <p style={{ marginTop: 10, opacity: 0.75 }}>
        Live preview only. No results have been archived.
      </p>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-slate-900">
        <h2 className="text-xl font-bold">Prize Pool Preview</h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Total Entries", String(members.length)],
            ["Paid Entries", String(paid.length)],
            ["Recorded Collections", money(collectedCents)],
            ["Hosting Fees", money(hostingCents)],
            ["Proposed Prize Pool", money(prizePoolCents)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-slate-100 p-4">
              <div className="text-sm text-slate-600">{label}</div>
              <div className="mt-1 text-2xl font-bold">{value}</div>
            </div>
          ))}
        </div>

        {missingAmounts.length > 0 && (
          <p className="mt-4 font-semibold text-amber-800">
            Warning: {missingAmounts.length} paid entries have missing
            or invalid payment amounts. The proposed prize pool is incomplete.
          </p>
        )}

        <p className="mt-4 text-sm text-slate-600">
          Hosting is calculated at $1 per paid entry. Amounts are based
          on payment records and will require commissioner confirmation.
        </p>
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-slate-900">
        <h2 className="text-xl font-bold">Season Completion Checklist</h2>
        <p className="mt-3">Unfinished games through current week: <strong>{unfinishedGames}</strong></p>
        <p className="mt-2">Future NFL games: <strong>{futureGames}</strong></p>
        <p className="mt-2">Pending player picks: <strong>{pendingPicks}</strong></p>
        <p className="mt-2">Current week picks locked: <strong>{picksLocked ? "Yes" : "No"}</strong></p>
        <p className="mt-3 text-sm text-slate-600">
          Future NFL games will not automatically block archiving
          if the Survivor Pool has already ended.
          These are preliminary checks. Final archiving will also require
          confirmation that the pool has ended, all weekly processing is
          complete, and payouts reconcile exactly.
        </p>
      </section>

      <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900">
        <h2 className="p-5 text-xl font-bold">Entries Preview</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-3">Player</th>
                <th className="p-3">Entry</th>
                <th className="p-3">Losses</th>
                <th className="p-3">Paid</th>
                <th className="p-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr
                  key={`${m.user_id}:${m.entry_no}`}
                  className="border-t border-slate-200"
                >
                  <td className="p-3">
                    {names.get(m.user_id) || m.screen_name || "Unknown"}
                  </td>
                  <td className="p-3">#{m.entry_no}</td>
                  <td className="p-3">{m.losses ?? 0}</td>
                  <td className="p-3">
                    {m.entry_fee_paid ? "Yes" : "No"}
                  </td>
                  <td className="p-3">
                    {m.entry_fee_amount == null
                      ? "—"
                      : money(Math.round(Number(m.entry_fee_amount) * 100))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <PayoutEditor
        entries={payoutEntries}
        prizePoolCents={prizePoolCents}
      />

      <p className="mt-6 font-semibold">
        Archiving is not enabled yet.
      </p>
    </main>
  );
}
