export type RankingEntry = {
  user_id: string;
  entry_no: number;
  losses: number;
  eliminated: boolean;
};

export type RankingPick = {
  user_id: string;
  entry_no: number;
  week_number: number;
  phase: string;
  result: string | null;
  counted_in_losses: boolean | null;
};

export type SuggestedRanking = {
  finish: number | null;
  eliminationWeek: string | null;
  needsReview: boolean;
};

function weekOrder(pick: RankingPick): number | null {
  const week = Number(pick.week_number);
  const phase = String(pick.phase).toLowerCase();

  if (phase === "regular" && week >= 1 && week <= 18) {
    return week;
  }

  if (phase === "playoffs" && week >= 1 && week <= 4) {
    return 18 + week;
  }

  return null;
}

function key(userId: string, entryNo: number): string {
  return `${userId}:${entryNo}`;
}

export function calculateFinishingPositions(
  entries: RankingEntry[],
  picks: RankingPick[]
): Map<string, SuggestedRanking> {
  const lossesByEntry = new Map<string, number[]>();

  for (const pick of picks) {
    if (
      String(pick.result).toLowerCase() !== "loss" ||
      pick.counted_in_losses !== true
    ) {
      continue;
    }

    const week = weekOrder(pick);
    if (week === null) continue;

    const entryKey = key(pick.user_id, Number(pick.entry_no));
    const weeks = lossesByEntry.get(entryKey) ?? [];
    weeks.push(week);
    lossesByEntry.set(entryKey, weeks);
  }

  const ranked = entries.map((entry) => {
    const entryKey = key(entry.user_id, entry.entry_no);
    const lossWeeks = [...(lossesByEntry.get(entryKey) ?? [])]
      .sort((a, b) => a - b);

    const eliminationOrder = lossWeeks[1] ?? null;
    const shouldBeEliminated =
      entry.eliminated || entry.losses >= 2;

    const needsReview =
      shouldBeEliminated !== (eliminationOrder !== null) ||
      entry.losses !== lossWeeks.length;

    return {
      entryKey,
      eliminationOrder,
      needsReview,
    };
  });

  const groups = new Map<number, typeof ranked>();

  for (const entry of ranked) {
    if (entry.needsReview) continue;

    const groupKey = entry.eliminationOrder ?? 999;
    const group = groups.get(groupKey) ?? [];
    group.push(entry);
    groups.set(groupKey, group);
  }

  const result = new Map<string, SuggestedRanking>();
  let nextPlace = 1;

  for (const order of [...groups.keys()].sort((a, b) => b - a)) {
    const group = groups.get(order) ?? [];

    for (const entry of group) {
      result.set(entry.entryKey, {
        finish: nextPlace,
        eliminationWeek:
          order === 999
            ? null
            : order > 18
              ? `P${order - 18}`
              : `W${order}`,
        needsReview: false,
      });
    }

    nextPlace += group.length;
  }

  for (const entry of ranked) {
    if (entry.needsReview) {
      result.set(entry.entryKey, {
        finish: null,
        eliminationWeek: null,
        needsReview: true,
      });
    }
  }

  return result;
}
