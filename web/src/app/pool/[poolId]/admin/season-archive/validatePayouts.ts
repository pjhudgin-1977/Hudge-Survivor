export type ArchivePayout = {
  user_id: string;
  entry_no: number;
  finish_place: number;
  winnings_cents: number;
};

export function validateArchivePayouts(
  payouts: ArchivePayout[],
  expectedEntryKeys: string[],
  prizePoolCents: number
): string | null {
  if (!Number.isSafeInteger(prizePoolCents) || prizePoolCents <= 0) {
    return "Invalid prize pool.";
  }

  if (payouts.length !== expectedEntryKeys.length) {
    return "Every entry must be included in the archive.";
  }

  const expected = new Set(expectedEntryKeys);
  const seen = new Set<string>();
  let total = 0;

  for (const payout of payouts) {
    const key = `${payout.user_id}:${payout.entry_no}`;

    if (!expected.has(key) || seen.has(key)) {
      return "Missing, duplicate, or unknown entry.";
    }

    seen.add(key);

    if (
      !Number.isSafeInteger(payout.finish_place) ||
      payout.finish_place < 1 ||
      payout.finish_place > payouts.length
    ) {
      return "Every entry needs a valid finishing position.";
    }

    if (
      !Number.isSafeInteger(payout.winnings_cents) ||
      payout.winnings_cents < 0
    ) {
      return "Winnings must be valid nonnegative amounts in cents.";
    }

    total += payout.winnings_cents;

    if (!Number.isSafeInteger(total)) {
      return "Payout total exceeds the supported amount.";
    }
  }

  if (total !== prizePoolCents) {
    return "Total winnings must equal the prize pool exactly.";
  }

  return null;
}
