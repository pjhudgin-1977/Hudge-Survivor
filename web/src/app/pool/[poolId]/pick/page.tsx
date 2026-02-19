"use client";

import { useParams } from "next/navigation";

export default function PoolPickPage() {
  const params = useParams();
  const poolId = params.poolId as string;

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Pick Page</h1>

      <p style={{ marginTop: 12, opacity: 0.85 }}>
        Pool ID: <strong>{poolId || "(missing)"}</strong>
      </p>

      <pre style={{ marginTop: 12, fontSize: 14 }}>
        {JSON.stringify(params, null, 2)}
      </pre>
    </main>
  );
}
