import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CommissionerActions from "./CommissionerActions";
import LaunchChecklist from "./LaunchChecklist";
type SummaryCardProps = {
  label: string;
  value: string | number;
  detail?: string;
};

type ToolCardProps = {
  title: string;
  desc: string;
  href: string;
};

type StatusItemProps = {
  label: string;
  value: string;
  status?: "good" | "warning" | "neutral";
};

function SummaryCard({ label, value, detail }: SummaryCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
      <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>

      <div className="mt-2 text-3xl font-bold">{value}</div>

      {detail ? (
        <div className="mt-2 text-sm text-slate-600">{detail}</div>
      ) : null}
    </div>
  );
}

function ToolCard({ title, desc, href }: ToolCardProps) {
  return (
    <Link
      href={href}
      className="grid gap-2 rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm transition hover:border-[#c83803] hover:shadow-md"
    >
      <div className="text-lg font-bold">{title}</div>
      <div className="text-sm text-slate-600">{desc}</div>
      <div className="mt-2 font-semibold text-[#c83803]">Open →</div>
    </Link>
  );
}

function StatusItem({
  label,
  value,
  status = "neutral",
}: StatusItemProps) {
  const statusClasses = {
    good: "border-emerald-200 bg-emerald-50 text-emerald-950",
    warning: "border-amber-200 bg-amber-50 text-amber-950",
    neutral: "border-slate-200 bg-slate-50 text-slate-900",
  };

  const dotClasses = {
    good: "bg-emerald-500",
    warning: "bg-amber-500",
    neutral: "bg-slate-400",
  };

  return (
    <div className={`rounded-lg border p-4 ${statusClasses[status]}`}>
      <div className="flex items-center gap-2">
        <span
          className={`h-2.5 w-2.5 rounded-full ${dotClasses[status]}`}
          aria-hidden="true"
        />

        <div className="text-sm font-semibold uppercase tracking-wide opacity-70">
          {label}
        </div>
      </div>

      <div className="mt-2 font-semibold">{value}</div>
    </div>
  );
}

function formatUpdatedAt(value: string | null) {
  if (!value) return "Never";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  }).format(new Date(value));
}

export default async function AdminHomePage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const { poolId } = await params;
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();

  if (!auth?.user) {
    redirect(`/login?next=/pool/${poolId}/admin`);
  }

  const { data: commissionerMembership } = await supabase
    .from("pool_members")
    .select("role")
    .eq("pool_id", poolId)
    .eq("user_id", auth.user.id)
    .eq("role", "commissioner")
    .limit(1)
    .maybeSingle();

  if (!commissionerMembership) {
    redirect(`/pool/${poolId}`);
  }

  const { data: poolState } = await supabase
    .from("pool_state")
    .select("season_year, week_type, week_number, picks_locked")
    .eq("pool_id", poolId)
    .maybeSingle();

  const seasonYear = Number(poolState?.season_year ?? 2026);
  const weekNumber = Number(poolState?.week_number ?? 1);
  const rawWeekType = String(
    poolState?.week_type ?? "REG"
  ).toUpperCase();
  const picksLocked = Boolean(poolState?.picks_locked);

  const pickWeekType =
    rawWeekType === "POST" || rawWeekType === "PLAYOFFS"
      ? "POST"
      : "REG";

  const gamePhase =
    rawWeekType === "POST" || rawWeekType === "PLAYOFFS"
      ? "playoffs"
      : "regular";

  const [
    membersResult,
    picksResult,
    gamesResult,
    spreadResult,
    autolockResult,
    gradingResult,
  ] = await Promise.all([
    supabase
      .from("pool_members")
      .select(
        "user_id, screen_name, entry_no, losses, eliminated, is_eliminated, entry_fee_paid"
      )
      .eq("pool_id", poolId)
      .order("entry_no", { ascending: true }),

    supabase
      .from("picks")
      .select("user_id, picked_team, locked")
      .eq("pool_id", poolId)
      .eq("week_number", weekNumber)
      .eq("week_type", pickWeekType),

    supabase
      .from("games")
      .select("id")
      .eq("season_year", seasonYear)
      .eq("week_number", weekNumber)
      .eq("phase", gamePhase),

    supabase
      .from("games")
      .select("spread_last_updated")
      .not("spread_last_updated", "is", null)
      .order("spread_last_updated", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("autolock_runs")
      .select("ran_at")
      .eq("status", "ok")
      .order("ran_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("grade_runs")
      .select("ran_at")
      .eq("status", "ok")
      .order("ran_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const members = membersResult.data ?? [];
  const picks = picksResult.data ?? [];
  const games = gamesResult.data ?? [];

  const activeMembers = members.filter(
    (member) => !member.eliminated && !member.is_eliminated
  );

  const submittedUserIds = new Set(
    picks
      .filter((pick) => Boolean(pick.picked_team))
      .map((pick) => pick.user_id)
  );

  const submittedCount = activeMembers.filter((member) =>
    submittedUserIds.has(member.user_id)
  ).length;

  const missingMembers = activeMembers.filter(
    (member) => !submittedUserIds.has(member.user_id)
  );

  const paidCount = members.filter(
    (member) => member.entry_fee_paid
  ).length;

  const lockedPickCount = picks.filter(
    (pick) => pick.locked
  ).length;

  const latestSpreadUpdate =
    spreadResult.data?.spread_last_updated ?? null;

  const latestAutolockRun =
    autolockResult.data?.ran_at ?? null;

  const latestGradingRun =
    gradingResult.data?.ran_at ?? null;

  const weekLabel =
    gamePhase === "playoffs"
      ? `Playoff Week ${weekNumber}`
      : `Week ${weekNumber}`;

  const submittedPercentage =
    activeMembers.length > 0
      ? Math.round(
          (submittedCount / activeMembers.length) * 100
        )
      : 0;

  return (
    <main className="mx-auto grid max-w-6xl gap-8 p-6">
      <header className="grid gap-2">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>

        <p className="text-slate-600">
          Commissioner overview and launch controls for the pool.
        </p>

        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          <Link
            href={`/pool/${poolId}`}
            className="font-semibold text-[#c83803] underline"
          >
            Back to pool
          </Link>

          <Link
            href={`/pool/${poolId}/invite`}
            className="font-semibold text-[#c83803] underline"
          >
            Invite page
          </Link>
        </div>
      </header>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">{weekLabel}</h2>
            <p className="text-sm text-slate-600">
              {seasonYear} NFL season
            </p>
          </div>

          <div
            className={[
              "rounded-full px-4 py-2 text-sm font-bold",
              picksLocked
                ? "bg-slate-800 text-white"
                : "bg-emerald-100 text-emerald-900",
            ].join(" ")}
          >
            {picksLocked
              ? "🔒 PICKS LOCKED"
              : "✓ PICKS OPEN"}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Entries"
            value={members.length}
            detail={`${activeMembers.length} still active`}
          />

          <SummaryCard
            label="Submitted Picks"
            value={`${submittedCount} / ${activeMembers.length}`}
            detail={`${missingMembers.length} missing`}
          />

          <SummaryCard
            label="Entry Fees Paid"
            value={`${paidCount} / ${members.length}`}
            detail={`${members.length - paidCount} unpaid`}
          />

          <SummaryCard
            label="Games This Week"
            value={games.length}
            detail={`${lockedPickCount} picks currently locked`}
          />
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Pick Submission Progress
              </div>

              <div className="mt-1 text-lg font-bold text-slate-900">
                {submittedCount} of {activeMembers.length} active entries
              </div>
            </div>

            <div className="text-2xl font-bold text-slate-900">
              {submittedPercentage}%
            </div>
          </div>

          <div
            className="mt-4 h-4 overflow-hidden rounded-full bg-slate-200"
            role="progressbar"
            aria-label="Submitted picks"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={submittedPercentage}
          >
            <div
              className="h-full rounded-full bg-[#c83803] transition-all"
              style={{
                width: `${submittedPercentage}%`,
              }}
            />
          </div>

          <div className="mt-2 text-sm text-slate-600">
            {missingMembers.length === 0
              ? "All active entries have submitted."
              : `${missingMembers.length} active ${
                  missingMembers.length === 1
                    ? "entry is"
                    : "entries are"
                } still missing a pick.`}
          </div>
        </div>
      </section>

      <CommissionerActions poolId={poolId} />
<LaunchChecklist
  activeEntries={activeMembers.length}
  submittedPicks={submittedCount}
  paidEntries={paidCount}
  totalEntries={members.length}
  gamesThisWeek={games.length}
  hasSpreadUpdate={Boolean(latestSpreadUpdate)}
  hasAutolockRun={Boolean(latestAutolockRun)}
  hasGradingRun={Boolean(latestGradingRun)}
/>
      <section className="rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
        <h2 className="text-xl font-bold">System Status</h2>

        <p className="mt-1 text-sm text-slate-600">
          Latest successful system activity.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatusItem
            label="Spread Update"
            value={formatUpdatedAt(latestSpreadUpdate)}
            status={latestSpreadUpdate ? "good" : "warning"}
          />

          <StatusItem
            label="Autolock Run"
            value={formatUpdatedAt(latestAutolockRun)}
            status={latestAutolockRun ? "good" : "warning"}
          />

          <StatusItem
            label="Grading Run"
            value={formatUpdatedAt(latestGradingRun)}
            status={latestGradingRun ? "good" : "warning"}
          />

          <StatusItem
            label="Pick Status"
            value={picksLocked ? "Locked" : "Open"}
            status={picksLocked ? "neutral" : "good"}
          />
        </div>
      </section>

      <section className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">
              Missing Picks ({missingMembers.length})
            </h2>

            <p className="mt-1 text-sm">
              Active entries that have not submitted a pick for {weekLabel}.
            </p>
          </div>

          <Link
            href={`/pool/${poolId}/admin/players`}
            className="rounded-lg border border-amber-400 bg-white px-3 py-2 text-sm font-bold text-amber-950 transition hover:bg-amber-100"
          >
            Manage Players →
          </Link>
        </div>

        {missingMembers.length === 0 ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
            <div className="font-bold">✓ Everyone has submitted</div>
            <div className="mt-1 text-sm">
              All active entries have a pick for {weekLabel}.
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            {missingMembers.map((member) => (
              <div
                key={`${member.user_id}-${member.entry_no}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-white p-4"
              >
                <div>
                  <div className="font-bold text-slate-900">
                    Entry {member.entry_no ?? "—"} · {member.screen_name}
                  </div>

                  <div className="mt-1 text-sm text-slate-600">
                    No pick submitted for {weekLabel}
                  </div>
                </div>

                <div
                  className={[
                    "rounded-full px-3 py-1 text-xs font-bold",
                    member.entry_fee_paid
                      ? "bg-emerald-100 text-emerald-900"
                      : "bg-amber-100 text-amber-950",
                  ].join(" ")}
                >
                  {member.entry_fee_paid ? "✓ PAID" : "PAYMENT DUE"}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-bold">
          Commissioner Tools
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <ToolCard
            title="Commissioner Dashboard"
            desc="Paid toggles, reset autopicks, force picks, and standings controls."
            href={`/pool/${poolId}/standings2`}
          />

          <ToolCard
            title="Players"
            desc="View members, payment status, strikes, and elimination status."
            href={`/pool/${poolId}/admin/players`}
          />

          <ToolCard
            title="Settings"
            desc="Review pool rules and configuration."
            href={`/pool/${poolId}/admin/settings`}
          />

          <ToolCard
            title="NFL Schedule"
            desc="Review games, kickoff times, results, and current spreads."
            href={`/pool/${poolId}/schedule?week=${weekNumber}`}
          />
        </div>
      </section>
    </main>
  );
}