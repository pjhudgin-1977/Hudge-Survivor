"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function extractPoolId(input: string): string | null {
  const s = String(input || "").trim();

  // UUID match (works even if they paste full URLs)
  const m = s.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  return m ? m[0] : null;
}

export default function JoinPoolClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const poolIdFromUrl = useMemo(() => {
    return (
      searchParams.get("poolId") ||
      searchParams.get("poolid") ||
      searchParams.get("id") ||
      ""
    );
  }, [searchParams]);

  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const didAutoGo = useRef(false);

  function go(raw: string) {
    const pid = extractPoolId(raw);
    if (!pid) {
      setError("Paste a valid invite link or pool id (UUID).");
      return;
    }
    router.push(`/join/${pid}`);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    go(text || poolIdFromUrl);
  }

  useEffect(() => {
    const raw = String(poolIdFromUrl || "").trim();
    if (!raw) return;

    setText(raw);

    if (didAutoGo.current) return;
    didAutoGo.current = true;

    go(raw);
  }, [poolIdFromUrl]);

  return (
    <main style={{ padding: 24, maxWidth: 560 }}>
      <h1 style={{ fontSize: 26, fontWeight: 900 }}>Join a Pool</h1>

      <p style={{ marginTop: 8, opacity: 0.85 }}>
        Paste your invite link or pool id below.
      </p>

      <form onSubmit={onSubmit} style={{ marginTop: 16 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste invite link or pool id…"
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.25)",
          }}
        />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <button
            type="submit"
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.35)",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            Continue
          </button>

          <button
            type="button"
            onClick={() => {
              setText("");
              setError(null);
            }}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.20)",
              cursor: "pointer",
              opacity: 0.85,
              fontWeight: 700,
            }}
          >
            Clear
          </button>
        </div>

        {error && (
          <p style={{ marginTop: 10, color: "#b00", fontWeight: 700 }}>
            {error}
          </p>
        )}
      </form>

      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>
        Tip: You can paste the full invite URL — we’ll extract the pool id automatically.
      </div>
    </main>
  );
}