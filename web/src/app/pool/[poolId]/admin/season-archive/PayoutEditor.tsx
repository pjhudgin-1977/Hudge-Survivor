"use client";

import { useMemo, useState } from "react";

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
        (finish !== "" && !/^[1-9]\d*$/.test(finish)) ||
        (cents !== null && cents > 0 && finish === "")
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

      <p className="p-5 text-sm text-slate-600">
        Preview only. No payouts or placements are saved,
        and archiving is not enabled.
      </p>
    </section>
  );
}
