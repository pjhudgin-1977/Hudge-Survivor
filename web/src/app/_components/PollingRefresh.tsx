"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type Props = {
  /** Poll interval in ms (default 15s) */
  intervalMs?: number;
  /** Turn off polling (default true) */
  enabled?: boolean;
};

export default function PollingRefresh({
  intervalMs = 15000,
  enabled = true,
}: Props) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    const id = window.setInterval(() => {
      router.refresh(); // re-runs the Server Component and re-fetches data
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [enabled, intervalMs, router]);

  return null;
}