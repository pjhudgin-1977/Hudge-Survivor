type ChecklistItem = {
  label: string;
  detail: string;
  complete: boolean;
};

type LaunchChecklistProps = {
  activeEntries: number;
  submittedPicks: number;
  paidEntries: number;
  totalEntries: number;
  gamesThisWeek: number;
  hasSpreadUpdate: boolean;
  hasAutolockRun: boolean;
  hasGradingRun: boolean;
};

export default function LaunchChecklist({
  activeEntries,
  submittedPicks,
  paidEntries,
  totalEntries,
  gamesThisWeek,
  hasSpreadUpdate,
  hasAutolockRun,
  hasGradingRun,
}: LaunchChecklistProps) {
  const checklist: ChecklistItem[] = [
    {
      label: "NFL schedule loaded",
      detail:
        gamesThisWeek > 0
          ? `${gamesThisWeek} games available for the current week.`
          : "No games found for the current week.",
      complete: gamesThisWeek > 0,
    },
    {
      label: "Active picks submitted",
      detail: `${submittedPicks} of ${activeEntries} active entries have submitted.`,
      complete:
        activeEntries > 0 && submittedPicks === activeEntries,
    },
    {
      label: "Entry fees recorded",
      detail: `${paidEntries} of ${totalEntries} entries are marked paid.`,
      complete:
        totalEntries > 0 && paidEntries === totalEntries,
    },
    {
      label: "Point spreads updated",
      detail: hasSpreadUpdate
        ? "A successful spread update has been recorded."
        : "No spread update has been recorded.",
      complete: hasSpreadUpdate,
    },
    {
      label: "Autolock verified",
      detail: hasAutolockRun
        ? "A successful autolock run has been recorded."
        : "No successful autolock run has been recorded.",
      complete: hasAutolockRun,
    },
    {
      label: "Grading verified",
      detail: hasGradingRun
        ? "A successful grading run has been recorded."
        : "No successful grading run has been recorded.",
      complete: hasGradingRun,
    },
  ];

  const completedCount = checklist.filter(
    (item) => item.complete
  ).length;

  const completionPercentage = Math.round(
    (completedCount / checklist.length) * 100
  );

  const launchReady = completedCount === checklist.length;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Launch Checklist</h2>

          <p className="mt-1 text-sm text-slate-600">
            Key items to verify before inviting real players.
          </p>
        </div>

        <div
          className={[
            "rounded-full px-4 py-2 text-sm font-bold",
            launchReady
              ? "bg-emerald-100 text-emerald-900"
              : "bg-amber-100 text-amber-950",
          ].join(" ")}
        >
          {launchReady
            ? "✓ READY FOR TESTING"
            : `${completedCount} OF ${checklist.length} COMPLETE`}
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-sm font-semibold">
          <span>Launch readiness</span>
          <span>{completionPercentage}%</span>
        </div>

        <div
          className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-label="Launch readiness"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={completionPercentage}
        >
          <div
            className="h-full rounded-full bg-[#c83803]"
            style={{
              width: `${completionPercentage}%`,
            }}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {checklist.map((item) => (
          <div
            key={item.label}
            className={[
              "rounded-lg border p-4",
              item.complete
                ? "border-emerald-200 bg-emerald-50"
                : "border-amber-200 bg-amber-50",
            ].join(" ")}
          >
            <div className="flex items-start gap-3">
              <div
                className={[
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                  item.complete
                    ? "bg-emerald-600 text-white"
                    : "bg-amber-500 text-white",
                ].join(" ")}
              >
                {item.complete ? "✓" : "!"}
              </div>

              <div>
                <div className="font-bold">{item.label}</div>

                <div className="mt-1 text-sm text-slate-600">
                  {item.detail}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}