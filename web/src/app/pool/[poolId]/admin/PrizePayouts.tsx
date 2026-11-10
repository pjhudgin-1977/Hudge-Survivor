
"use client";

import { useEffect, useState } from "react";

type Props = {
  entryCount: number;
  seasonYear: number;
};

const ENTRY_FEE = 20;
const HOSTING_FEE = 1;

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export default function PrizePayouts({
  entryCount,
  seasonYear,
}: Props) {
  const grossCents = entryCount * ENTRY_FEE * 100;
  const hostingCents = entryCount * HOSTING_FEE * 100;
  const netCents = grossCents - hostingCents;

  const first = Math.round(netCents * 0.6);
  const second = Math.round(netCents * 0.25);
  const third = Math.round(netCents * 0.1);
  const fourth = netCents - first - second - third;

  const defaultMessage = [
    `🏈 HUDGE SURVIVOR POOL — ${seasonYear} PAYOUTS`,
    "",
    `${entryCount} entries × $20 = ${money(grossCents)}`,
    `Hosting fees: ${money(hostingCents)}`,
    `Total Prize Pool: ${money(netCents)}`,
    "",
    `🥇 1st Place (60%): ${money(first)}`,
    `🥈 2nd Place (25%): ${money(second)}`,
    `🥉 3rd Place (10%): ${money(third)}`,
    `🏅 4th Place (5%): ${money(fourth)}`,
    "",
    "Good luck to everyone!",
  ].join("\n");

  const [message, setMessage] = useState(defaultMessage);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMessage(defaultMessage);
    setCopied(false);
  }, [defaultMessage]);

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      setCopied(false);
      alert("Unable to copy. Please select and copy the text.");
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
      <h2 className="text-2xl font-bold">
        Season Prize Payouts
      </h2>

      <p className="mt-1 text-sm text-slate-600">
        {seasonYear} season · ${ENTRY_FEE} per entry ·
        ${HOSTING_FEE} hosting fee per entry
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-slate-100 p-4">
          <div className="text-sm text-slate-600">
            Gross Entry Fees
          </div>
          <div className="mt-1 text-2xl font-bold">
            {money(grossCents)}
          </div>
          <div className="text-xs text-slate-500">
            {entryCount} entries
          </div>
        </div>

        <div className="rounded-lg bg-slate-100 p-4">
          <div className="text-sm text-slate-600">
            Hosting Fees
          </div>
          <div className="mt-1 text-2xl font-bold">
            {money(hostingCents)}
          </div>
        </div>

        <div className="rounded-lg border border-orange-300 bg-orange-50 p-4">
          <div className="text-sm font-semibold text-slate-700">
            Net Prize Pool
          </div>
          <div className="mt-1 text-3xl font-bold text-slate-950">
            {money(netCents)}
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
        {[
          ["🥇 1st Place", "60%", first],
          ["🥈 2nd Place", "25%", second],
          ["🥉 3rd Place", "10%", third],
          ["🏅 4th Place", "5%", fourth],
        ].map(([label, percent, amount]) => (
          <div
            key={String(label)}
            className="flex items-center justify-between gap-3 border-b border-slate-200 p-3 last:border-0"
          >
            <div className="font-semibold">
              {label}
              <span className="ml-2 text-sm font-normal text-slate-500">
                ({percent})
              </span>
            </div>
            <div className="font-bold">
              {money(Number(amount))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-bold">
          Message Board Announcement
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Edit the announcement if desired, then copy it
          to the Message Board.
        </p>

        <textarea
          className="mt-3 min-h-[310px] w-full rounded-lg border border-slate-300 bg-slate-50 p-4 font-mono text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
            setCopied(false);
          }}
          spellCheck={false}
          aria-label="Prize payout announcement"
        />

        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={copyMessage}
            className="rounded-lg bg-orange-500 px-5 py-3 font-bold text-black transition hover:bg-orange-400"
          >
            {copied ? "✓ Copied!" : "Copy Message"}
          </button>

          <button
            type="button"
            onClick={() => {
              setMessage(defaultMessage);
              setCopied(false);
            }}
            className="rounded-lg border border-slate-300 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-100"
          >
            Reset Message
          </button>
        </div>
      </div>
    </section>
  );
}
