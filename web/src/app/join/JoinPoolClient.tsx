"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function extractInviteCode(input: string): string | null {
  const value = String(input || "").trim().toUpperCase();
  const match = value.match(/HUDGE-[A-Z0-9]{4}/);

  return match?.[0] ?? null;
}

export default function JoinPoolClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const inviteFromUrl = useMemo(() => {
    return (
      searchParams.get("code") ||
      searchParams.get("invite") ||
      searchParams.get("poolId") ||
      ""
    );
  }, [searchParams]);

  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const didAutoGo = useRef(false);

  function go(raw: string) {
    const code = extractInviteCode(raw);

    if (!code) {
      setError(
        "Enter a valid invite code such as HUDGE-AB12, or paste the complete invite link."
      );
      return;
    }

    router.push(`/join/${code}`);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    go(text || inviteFromUrl);
  }

  useEffect(() => {
    const raw = String(inviteFromUrl || "").trim();

    if (!raw) return;

    setText(raw);

    if (didAutoGo.current) return;
    didAutoGo.current = true;

    go(raw);
  }, [inviteFromUrl]);

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 24,
        background:
          "linear-gradient(180deg, #050A14 0%, #050812 50%, #04060F 100%)",
        color: "white",
      }}
    >
      <div style={{ width: "100%", maxWidth: 560, margin: "40px auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 950 }}>Join a Pool</h1>

        <p style={{ marginTop: 8, opacity: 0.82, lineHeight: 1.5 }}>
          Enter the invite code provided by your commissioner, or paste the
          complete invite link.
        </p>

        <form onSubmit={onSubmit} style={{ marginTop: 20 }}>
          <label
            htmlFor="invite-code"
            style={{
              display: "block",
              marginBottom: 7,
              fontSize: 13,
              fontWeight: 900,
            }}
          >
            Invite code or link
          </label>

          <input
            id="invite-code"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            placeholder="HUDGE-AB12"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            style={{
              width: "100%",
              padding: "12px 13px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.22)",
              background: "rgba(255,255,255,0.08)",
              color: "white",
              fontSize: 16,
              outline: "none",
            }}
          />

          {error ? (
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(255,90,90,0.35)",
                background: "rgba(255,90,90,0.10)",
                color: "#fecaca",
                fontWeight: 800,
                fontSize: 13,
              }}
            >
              {error}
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginTop: 14,
            }}
          >
            <button
              type="submit"
              style={{
                padding: "11px 16px",
                borderRadius: 11,
                border: "1px solid rgba(255,255,255,0.18)",
                background:
                  "linear-gradient(180deg, rgba(255,92,0,1), rgba(255,92,0,0.76))",
                color: "white",
                cursor: "pointer",
                fontWeight: 950,
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
                padding: "11px 16px",
                borderRadius: 11,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.07)",
                color: "white",
                cursor: "pointer",
                fontWeight: 800,
              }}
            >
              Clear
            </button>
          </div>
        </form>

        <div style={{ marginTop: 14, fontSize: 12, opacity: 0.7 }}>
          Pool IDs are not accepted. A valid HUDGE invite code is required.
        </div>
      </div>
    </main>
  );
}
