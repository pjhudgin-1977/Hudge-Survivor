"use client";

import { useParams } from "next/navigation";
import Link from "next/link";

export default function PoolDashboardPage() {
  const params = useParams();
  const poolId = params.poolId as string;

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>
        Pool Dashboard
      </h1>

      <p style={{ marginTop: 8, opacity: 0.8 }}>
        Pool ID: <strong>{poolId}</strong>
      </p>

      <Link
        href={`/pool/${poolId}/pick`}
        className="inline-block mt-4 rounded bg-black text-white px-4 py-2"
      >
        Make a Pick
      </Link>
    </main>
  );
}
