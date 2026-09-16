"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Props = {
  poolId: string;
  selectedWeek: number;
};

export default function MobileWeekSelector({
  poolId,
  selectedWeek,
}: Props) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (open) {
      timerRef.current = setTimeout(() => {
        setOpen(false);
      }, 5000);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [open]);

  return (
    <div className="relative md:hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-3 text-left font-bold text-slate-900"
      >
        Week {selectedWeek} ▾
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-20 mt-2 grid grid-cols-3 gap-2 rounded-xl border border-slate-300 bg-white p-3 shadow-xl">
          {Array.from({ length: 18 }, (_, index) => {
            const week = index + 1;
            const isActive = week === selectedWeek;

            return (
              <Link
                key={week}
                href={`/pool/${poolId}/schedule?week=${week}`}
                className={[
                  "rounded-lg border px-2 py-2 text-center text-sm font-semibold",
                  isActive
                    ? "border-[#c83803] bg-[#c83803] text-white"
                    : "border-slate-300 bg-slate-50 text-slate-800",
                ].join(" ")}
              >
                Week {week}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}