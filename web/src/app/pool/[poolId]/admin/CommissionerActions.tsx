"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ActionName = "update-spreads" | "autolock" | "grade";

type ActionConfig = {
  action: ActionName;
  label: string;
  workingLabel: string;
  description: string;
  confirmMessage?: string;
};

type ActionResult = {
  message: string;
  completedAt: string;
  isError: boolean;
};

const ACTIONS: ActionConfig[] = [
  {
    action: "update-spreads",
    label: "Update Spreads",
    workingLabel: "Updating Spreads…",
    description: "Fetch the latest NFL point spreads and save them.",
  },
  {
    action: "autolock",
    label: "Run Autolock",
    workingLabel: "Running Autolock…",
    description: "Lock picks whose game kickoff times have passed.",
    confirmMessage:
      "Run autolock now? Picks for games that have started may be locked.",
  },
  {
    action: "grade",
    label: "Run Grading",
    workingLabel: "Running Grading…",
    description: "Grade completed games and apply losses.",
    confirmMessage:
      "Run grading now? This may update picks, losses, and elimination status.",
  },
];

function formatCompletedTime() {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  }).format(new Date());
}

function getSuccessMessage(action: ActionName, result: any) {
  if (action === "update-spreads") {
    const updated = Number(result?.result?.games_updated ?? 0);
    const unmatched = Number(result?.result?.games_unmatched ?? 0);

    return `Updated ${updated} games${
      unmatched > 0 ? `; ${unmatched} unmatched` : ""
    }.`;
  }

  if (action === "autolock") {
    return "Autolock completed successfully.";
  }

  const graded = Number(
    result?.result?.graded_updated_count ?? 0
  );

  const losses = Number(
    result?.result?.total_updated_members ?? 0
  );

  return `Graded ${graded} picks and updated ${losses} member loss records.`;
}

export default function CommissionerActions({
  poolId,
}: {
  poolId: string;
}) {
  const router = useRouter();

  const [runningAction, setRunningAction] =
    useState<ActionName | null>(null);

  const [results, setResults] = useState<
    Partial<Record<ActionName, ActionResult>>
  >({});

  async function runAction(config: ActionConfig) {
    if (runningAction) return;

    if (
      config.confirmMessage &&
      !window.confirm(config.confirmMessage)
    ) {
      return;
    }

    setRunningAction(config.action);

    try {
      const response = await fetch(
        `/api/pool/${poolId}/admin/run-action`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            action: config.action,
          }),
        }
      );

      const contentType =
        response.headers.get("content-type") ?? "";

      if (!contentType.includes("application/json")) {
        const text = await response.text();

        throw new Error(
          `Server returned a non-JSON response (${response.status}): ${text.slice(
            0,
            120
          )}`
        );
      }

      const result = await response.json();

      if (!response.ok || !result?.ok) {
        throw new Error(
          result?.error ?? `${config.label} failed.`
        );
      }

      setResults((current) => ({
        ...current,
        [config.action]: {
          message: getSuccessMessage(
            config.action,
            result
          ),
          completedAt: formatCompletedTime(),
          isError: false,
        },
      }));

      router.refresh();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      setResults((current) => ({
        ...current,
        [config.action]: {
          message,
          completedAt: formatCompletedTime(),
          isError: true,
        },
      }));
    } finally {
      setRunningAction(null);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
      <div>
        <h2 className="text-xl font-bold">
          Commissioner Actions
        </h2>

        <p className="mt-1 text-sm text-slate-600">
          Run important game-day processes without leaving this page.
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {ACTIONS.map((config) => {
          const isRunning =
            runningAction === config.action;

          const result = results[config.action];

          return (
            <div
              key={config.action}
              className="rounded-xl border border-slate-300 bg-slate-50 p-4"
            >
              <button
                type="button"
                onClick={() => runAction(config)}
                disabled={runningAction !== null}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-left transition hover:border-[#c83803] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="font-bold text-[#c83803]">
                  {isRunning
                    ? config.workingLabel
                    : config.label}
                </div>

                <div className="mt-2 text-sm text-slate-600">
                  {config.description}
                </div>
              </button>

              {result ? (
                <div
                  className={[
                    "mt-3 rounded-lg border p-3 text-sm",
                    result.isError
                      ? "border-red-300 bg-red-50 text-red-800"
                      : "border-emerald-300 bg-emerald-50 text-emerald-900",
                  ].join(" ")}
                >
                  <div className="font-semibold">
                    {result.isError ? "✕ Failed" : "✓ Success"}
                  </div>

                  <div className="mt-1">
                    {result.message}
                  </div>

                  <div className="mt-2 text-xs opacity-75">
                    Completed {result.completedAt}
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-xs text-slate-500">
                  Not run during this visit.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}