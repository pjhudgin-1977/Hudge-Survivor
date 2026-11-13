"use client";

import { useEffect, useMemo, useState } from "react";

type Entry = {
  user_id: string;
  entry_no: number;
  name: string;
  losses: number;
  suggestedFinish: number | null;
  needsReview: boolean;
};

type Draft = {
  finish: string;
  winnings: string;
};

type Props = {
  poolId: string;
  seasonYear: number;
  entries: Entry[];
  prizePoolCents: number;
};

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function parseCents(value: string): number | null {
  const trimmed = value.trim();

  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }

  const [dollars, decimals = ""] = trimmed.split(".");
  const cents = Number(dollars) * 100 +
    Number(decimals.padEnd(2, "0"));

  return Number.isSafeInteger(cents) ? cents : null;
}

function entryKey(entry: Entry) {
  return `${entry.user_id}:${entry.entry_no}`;
}

export default function PayoutEditor({
  poolId,
  seasonYear,
  entries,
  prizePoolCents,
}: Props) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>(
    () =>
      Object.fromEntries(
        entries.map((entry) => [
          entryKey(entry),
          {
            finish: String(entry.suggestedFinish ?? ""),
            winnings: "0.00",
          },
        ])
      )
  );

  const [archiveStatus, setArchiveStatus] = useState<{
    seasonChecksPassed: boolean;
    alreadyArchived: boolean;
    blockers: string[];
  } | null>(null);

  const [statusError, setStatusError] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const [archiveSuccess, setArchiveSuccess] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function checkArchiveStatus() {
      try {
        const response = await fetch(
          `/api/pool/${poolId}/admin/season-archive`,
          { signal: controller.signal, cache: "no-store" }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to check archive status");
        }

        if (!controller.signal.aborted) {
          setArchiveStatus(data);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setStatusError(
            error instanceof Error ? error.message : "Status check failed"
          );
        }
      }
    }

    checkArchiveStatus();
    return () => controller.abort();
  }, [poolId, seasonYear]);

  const summary = useMemo(() => {
    let total = 0;
    let invalid = 0;
    let winners = 0;

    for (const entry of entries) {
      const draft = drafts[entryKey(entry)];
      const cents = parseCents(draft?.winnings ?? "");
      const finish = (draft?.finish ?? "").trim();

      if (
        cents === null ||
        !/^[1-9]\d*$/.test(finish) ||
        Number(finish) > entries.length
      ) {
        invalid++;
      }

      if (cents !== null) {
        total += cents;
        if (cents > 0) winners++;
      }
    }

    return {
      total,
      invalid,
      winners,
      difference: prizePoolCents - total,
    };
  }, [drafts, entries, prizePoolCents]);

  async function submitArchive() {
    if (
      submitting ||
      !balanced ||
      !archiveStatus?.seasonChecksPassed ||
      archiveStatus.alreadyArchived ||
      confirmationText !== `ARCHIVE ${seasonYear}`
    ) {
      setArchiveError("Archive requirements have not been met.");
      return;
    }

    const payouts = entries.map((entry) => {
      const draft = drafts[entryKey(entry)];
      return {
        user_id: entry.user_id,
        entry_no: entry.entry_no,
        finish_place: Number(draft.finish),
        winnings_cents: parseCents(draft.winnings),
      };
    });

    setSubmitting(true);
    setArchiveError("");

    try {
      const response = await fetch(
        `/api/pool/${poolId}/admin/season-archive`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seasonYear,
            payouts,
            confirmation: confirmationText,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || result?.ok !== true) {
        throw new Error(result?.error || "Archive request failed.");
      }

      setArchiveSuccess(true);
      setArchiveStatus((previous) =>
        previous ? { ...previous, alreadyArchived: true } : previous
      );
    } catch (error) {
      setArchiveError(
        error instanceof Error ? error.message : "Archive failed."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function update(key: string, field: keyof Draft, value: string) {
    setDrafts((previous) => ({
      ...previous,
      [key]: {
        ...previous[key],
        [field]: value,
      },
    }));
  }

  const balanced =
    summary.difference === 0 &&
    summary.invalid === 0 &&
    prizePoolCents > 0;

  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900">
      <div className="p-5">
        <div className="mb-5 rounded-lg border border-slate-300 bg-slate-50 p-4">
          <h3 className="font-bold">Archive Eligibility</h3>

          {statusError ? (
            <p className="mt-2 text-amber-800">{statusError}</p>
          ) : !archiveStatus ? (
            <p className="mt-2">Checking season status...</p>
          ) : archiveStatus.alreadyArchived ? (
            <p className="mt-2">This season is already archived.</p>
          ) : archiveStatus.seasonChecksPassed ? (
            <p className="mt-2">
              Preliminary season checks passed. Final approval is still required.
            </p>
          ) : (
            <>
              <p className="mt-2 font-semibold">
                Archiving is currently blocked:
              </p>
              <ul className="mt-2 list-disc pl-5">
                {archiveStatus.blockers.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </>
          )}
        </div>

        <h2 className="text-xl font-bold">
          Final Placements & Winnings
        </h2>

        <p className="mt-2 text-sm text-slate-600">
          Enter official finishing positions and actual winnings.
          Use the same position for tied entries.
          Suggested positions are based on elimination order.
          You can change any position. These edits are not saved yet.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-100 p-4">
            <div className="text-sm">Available Prize Pool</div>
            <div className="text-2xl font-bold">
              {money(prizePoolCents)}
            </div>
          </div>

          <div className="rounded-lg bg-slate-100 p-4">
            <div className="text-sm">Winnings Entered</div>
            <div className="text-2xl font-bold">
              {money(summary.total)}
            </div>
          </div>

          <div className="rounded-lg bg-slate-100 p-4">
            <div className="text-sm">Difference</div>
            <div className="text-2xl font-bold">
              {money(summary.difference)}
            </div>
          </div>
        </div>

        <p className="mt-4 font-semibold">
          {balanced
            ? "✓ Payouts match the prize pool exactly."
            : "Payouts must match the prize pool exactly before archiving."}
        </p>

        {summary.invalid > 0 && (
          <p className="mt-2 text-sm font-semibold text-amber-800">
            {summary.invalid} entries need correction.
            Winnings must be valid dollar amounts, and every
            winner must have a finishing position.
          </p>
        )}

        <p className="mt-2 text-sm text-slate-600">
          {summary.winners} entries currently have winnings.
        </p>
      </div>

      <div className="max-h-[650px] overflow-auto">
        <table className="w-full min-w-[650px] text-left text-sm">
          <thead className="sticky top-0 bg-slate-100">
            <tr>
              <th className="p-3">Player</th>
              <th className="p-3">Entry</th>
              <th className="p-3">Losses</th>
              <th className="p-3">Finish</th>
              <th className="p-3">Winnings ($)</th>
            </tr>
          </thead>

          <tbody>
            {entries.map((entry) => {
              const key = entryKey(entry);
              const draft = drafts[key];

              return (
                <tr key={key} className="border-t border-slate-200">
                  <td className="p-3 font-semibold">{entry.name}</td>
                  <td className="p-3">#{entry.entry_no}</td>
                  <td className="p-3">
                    {entry.losses}
                    {entry.needsReview && (
                      <span className="ml-2 font-semibold text-amber-700">
                        Review
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      aria-label={`Finish for ${entry.name} entry ${entry.entry_no}`}
                      className="w-20 rounded border border-slate-300 p-2"
                      value={draft.finish}
                      onChange={(e) =>
                        update(key, "finish", e.target.value)
                      }
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label={`Winnings for ${entry.name} entry ${entry.entry_no}`}
                      className="w-28 rounded border border-slate-300 p-2"
                      value={draft.winnings}
                      onChange={(e) =>
                        update(key, "winnings", e.target.value)
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-200 p-5">
        <button
          type="button"
          onClick={() => setReviewOpen(!reviewOpen)}
          className="rounded-lg bg-orange-500 px-5 py-3 font-bold text-black hover:bg-orange-400"
        >
          {reviewOpen ? "Close Review" : "Review Final Archive"}
        </button>

        {reviewOpen && (
          <div className="mt-5 rounded-lg border border-slate-300 bg-slate-50 p-5">
            <h3 className="text-xl font-bold">
              {seasonYear} Archive Review
            </h3>

            <p className="mt-3">Total entries: {entries.length}</p>
            <p className="mt-2">
              Prize pool: {money(prizePoolCents)}
            </p>
            <p className="mt-2">
              Winnings assigned: {money(summary.total)}
            </p>
            <p className="mt-2">
              Difference: {money(summary.difference)}
            </p>
            <p className="mt-2">
              Entries requiring correction: {summary.invalid}
            </p>

            <h4 className="mt-5 font-bold">Entries with Winnings</h4>

            {summary.winners === 0 ? (
              <p className="mt-2 text-slate-600">
                No winnings assigned yet.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {entries.filter((entry) => {
                  const cents = parseCents(
                    drafts[entryKey(entry)]?.winnings ?? ""
                  );
                  return cents !== null && cents > 0;
                }).map((entry) => {
                  const draft = drafts[entryKey(entry)];
                  const cents = parseCents(draft.winnings) ?? 0;

                  return (
                    <li key={entryKey(entry)}>
                      {entry.name} #{entry.entry_no}
                      {" — "}Place {draft.finish}
                      {" — "}{money(cents)}
                    </li>
                  );
                })}
              </ul>
            )}

            <p className="mt-5 font-semibold">
              {archiveStatus?.seasonChecksPassed && balanced
                ? "Financial and preliminary season checks passed. Final confirmation will be required."
                : "Archiving is not available until all season and payout checks pass."}
            </p>

            <label className="mt-5 block font-bold">Final confirmation: type ARCHIVE {seasonYear}</label>
            <input type="text" value={confirmationText} onChange={(e) => setConfirmationText(e.target.value)} placeholder={`ARCHIVE ${seasonYear}`} className="mt-2 rounded-lg border border-slate-300 p-3" />
            <p className="mt-2 text-sm">{confirmationText === `ARCHIVE ${seasonYear}` ? "Confirmation matches." : "Final confirmation required."}</p>

            <button
              type="button"
              onClick={submitArchive}
              disabled={
                submitting ||
                archiveSuccess ||
                !balanced ||
                !archiveStatus?.seasonChecksPassed ||
                archiveStatus.alreadyArchived ||
                confirmationText !== `ARCHIVE ${seasonYear}`
              }
              className="mt-4 rounded-lg bg-orange-500 px-5 py-3 font-bold text-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Archiving..." : archiveSuccess ? "Season Archived" : `Archive ${seasonYear} Season`}
            </button>
            {archiveError && <p className="mt-3 font-semibold text-red-700">{archiveError}</p>}
            {archiveSuccess && <p className="mt-3 font-semibold text-green-800">Season archived successfully.</p>}

            <p className="mt-3 text-sm text-slate-600">
              Placements and payouts are not saved until you successfully archive the completed season.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
