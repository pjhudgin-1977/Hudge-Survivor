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

export default function CommissionerActions({
  poolId,
}: {
  poolId: string;
}) {
  const router = useRouter();

  const [runningAction, setRunningAction] =
    useState<ActionName | null>(null);

  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function runAction(config: ActionConfig) {
    if (runningAction) return;

    if (
      config.confirmMessage &&
      !window.confirm(config.confirmMessage)
    ) {
      return;
    }

    setRunningAction(config.action);
    setMessage("");
    setIsError(false);

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

      if (config.action === "update-spreads") {
        const updated =
          result?.result?.games_updated ?? 0;

        setMessage(
          `Spreads updated successfully. ${updated} games updated.`
        );
      } else if (config.action === "autolock") {
        setMessage("Autolock completed successfully.");
      } else {
        const graded =
          result?.result?.graded_updated_count ?? 0;

        setMessage(
          `Grading completed successfully. ${graded} picks graded.`
        );
      }

      router.refresh();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : String(error);

      setIsError(true);
      setMessage(errorMessage);
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

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {ACTIONS.map((config) => {
          const isRunning =
            runningAction === config.action;

          return (
            <button
              key={config.action}
              type="button"
              onClick={() => runAction(config)}
              disabled={runningAction !== null}
              className="rounded-xl border border-slate-300 bg-slate-50 p-4 text-left transition hover:border-[#c83803] hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
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
          );
        })}
      </div>

      {message ? (
        <div
          className={[
            "mt-4 rounded-lg border p-3 text-sm font-semibold",
            isError
              ? "border-red-300 bg-red-50 text-red-800"
              : "border-emerald-300 bg-emerald-50 text-emerald-900",
          ].join(" ")}
        >
          {message}
        </div>
      ) : null}
    </section>
  );
}
