"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function JoinPoolClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const poolIdFromUrl =
    searchParams.get("poolId") || searchParams.get("poolid") || "";

  const [poolId, setPoolId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const didAutoJoin = useRef(false);

  async function joinPool(id: string) {
    setJoining(true);
    setError(null);

    try {
      const res = await fetch("/api/join-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poolId: id }),
      });

      const contentType = res.headers.get("content-type") || "";
      const body = contentType.includes("application/json")
        ? await res.json().catch(() => ({}))
        : await res.text().catch(() => "");

      if (!res.ok) {
        const msg =
          typeof body === "string"
            ? body.slice(0, 300)
            : body?.error || `Failed to join pool (status ${res.status}).`;
        setError(msg);
        return;
      }

      router.push(`/pool/${id}`);
    } catch (err: any) {
      setError(err?.message || "Join failed (network / server error).");
    } finally {
      setJoining(false);
    }
  }

  async function onJoin(e: React.FormEvent) {
    e.preventDefault();

    const id = (poolId || poolIdFromUrl).trim();
    if (!id) {
      setError("Enter a Pool ID.");
      return;
    }

    await joinPool(id);
  }

  useEffect(() => {
    const id = poolIdFromUrl.trim();
    if (!id) return;

    setPoolId(id);

    if (didAutoJoin.current) return;
    didAutoJoin.current = true;

    joinPool(id);
  }, [poolIdFromUrl]);

  return (
    <main style={{ padding: 24, maxWidth: 520 }}>
      <h1 style={{ fontSize: 26, fontWeight: 800 }}>Join a Pool</h1>

      <p style={{ marginTop: 8, opacity: 0.8 }}>
        Paste the Pool ID you were given.
      </p>

      <form onSubmit={onJoin} style={{ marginTop: 16 }}>
        <input
          value={poolId}
          onChange={(e) => setPoolId(e.target.value)}
          placeholder="e.g. 4931be58-aa45-4c89-aa36-2f0aa1061f45"
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 8,
            border: "1px solid #ccc",
          }}
        />

        <button
          type="submit"
          disabled={joining}
          style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #333",
            cursor: "pointer",
          }}
        >
          {joining ? "Joining..." : "Join"}
        </button>

        {error && (
          <p style={{ marginTop: 10, color: "#b00", fontWeight: 600 }}>
            {error}
          </p>
        )}
      </form>
    </main>
  );
}