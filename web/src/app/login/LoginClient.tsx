"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      setErr(error.message);
      return;
    }

    // honor ?next=
    const next = sp.get("next");
    if (next) {
      setLoading(false);
      router.push(next);
      return;
    }

    // Otherwise: go to first pool if any, else dashboard
    const { data: member } = await supabase
      .from("pool_members")
      .select("pool_id")
      .limit(1)
      .maybeSingle();

    setLoading(false);

    if (member?.pool_id) {
      router.push(`/pool/${member.pool_id}`);
    } else {
      router.push("/dashboard?onboarding=joinonly");
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 20,
        background:
          "radial-gradient(1200px 600px at 20% 0%, rgba(255,92,0,0.18), transparent 60%), radial-gradient(900px 500px at 100% 10%, rgba(255,255,255,0.10), transparent 55%), linear-gradient(180deg, #050A14 0%, #050812 45%, #04060F 100%)",
        color: "white",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 430,
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(10, 14, 28, 0.72)",
          boxShadow: "0 18px 60px rgba(0,0,0,0.55)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "18px 18px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.10)",
            background:
              "linear-gradient(180deg, rgba(255,92,0,0.14), rgba(255,92,0,0.02))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              aria-hidden
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.16)",
                background:
                  "radial-gradient(circle at 30% 30%, rgba(255,92,0,0.9), rgba(255,92,0,0.15))",
                boxShadow: "0 10px 25px rgba(255,92,0,0.18)",
              }}
            />
            <div>
              <div style={{ fontSize: 18, fontWeight: 950, letterSpacing: 0.2 }}>
                Hudge Survivor Pool
              </div>
              <div style={{ fontSize: 13, opacity: 0.78, marginTop: 2 }}>
                Sign in to make picks, sweat games, and survive 🐻
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit} style={{ padding: 18 }}>
          <label style={labelStyle}>Email</label>
          <input
            style={inputStyle}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            inputMode="email"
          />

          <div style={{ height: 12 }} />

          <label style={labelStyle}>Password</label>
          <input
            style={inputStyle}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />

          {err ? (
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,70,70,0.35)",
                background: "rgba(255,70,70,0.10)",
                color: "rgba(255,210,210,0.95)",
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              {err}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 14,
              width: "100%",
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.18)",
              background: loading
                ? "rgba(255,255,255,0.12)"
                : "linear-gradient(180deg, rgba(255,92,0,0.95), rgba(255,92,0,0.72))",
              color: "white",
              fontWeight: 950,
              letterSpacing: 0.2,
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: loading ? "none" : "0 12px 30px rgba(255,92,0,0.22)",
            }}
          >
            {loading ? "Signing in…" : "Log in"}
          </button>

          <div style={{ marginTop: 14, fontSize: 12, opacity: 0.75, lineHeight: 1.4 }}>
            New here? You’ll need an invite link from your commissioner. If you already
            have one, paste it on the Dashboard after login.
          </div>
        </form>
      </div>
    </main>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.25,
  opacity: 0.85,
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(0,0,0,0.25)",
  color: "white",
  outline: "none",
};