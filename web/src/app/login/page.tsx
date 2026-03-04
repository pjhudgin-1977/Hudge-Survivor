"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { createClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  // Read ?next=... only on the client (avoids prerender issues)
  const [next, setNext] = useState<string>("/");

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const n = sp.get("next");
      setNext(n && n.startsWith("/") ? n : "/");
    } catch {
      setNext("/");
    }
  }, []);

  const [mode, setMode] = useState<"signin" | "signup">("signin");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [fullName, setFullName] = useState("");
  const [referrer, setReferrer] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const nextLabel = useMemo(() => next || "/", [next]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const supabase = createClient();

    try {
      setLoading(true);

      if (mode === "signup") {
        if (!fullName.trim()) {
          setErr("Please enter your full name.");
          return;
        }
        if (!referrer.trim()) {
          setErr("Please tell us who invited you.");
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              referred_by: referrer.trim(),
            },
          },
        });

        if (error) {
          setErr(error.message);
          return;
        }

        window.location.assign(nextLabel);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErr(error.message);
        return;
      }

      window.location.assign(nextLabel);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={page}>
      <div style={card}>
        <div style={{ padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={logo} />
            <div>
              <div style={{ fontSize: 30, fontWeight: 950, lineHeight: 1.05 }}>
                Hudge Survivor Pool
              </div>
              <div style={{ opacity: 0.85, marginTop: 4 }}>
                New player? Tap <b>Create account</b> and you’ll be added automatically.
              </div>
            </div>
          </div>

          <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setMode("signin")}
              style={mode === "signin" ? pillActive : pill}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              style={mode === "signup" ? pillActive : pill}
            >
              Create account
            </button>
          </div>

          {mode === "signin" && (
            <div style={hintBox}>
              New here? Click <b>Create account</b> above. If you came from an invite link,
              we’ll take you right back to it and add you automatically.
            </div>
          )}
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }} />

        <form onSubmit={submit} style={{ padding: 22 }}>
          {mode === "signup" && (
            <>
              <label style={labelStyle}>Full name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full name"
                style={inputStyle}
                autoComplete="name"
              />

              <label style={{ ...labelStyle, marginTop: 16 }}>Who invited you?</label>
              <input
                value={referrer}
                onChange={(e) => setReferrer(e.target.value)}
                placeholder="Commissioner / friend"
                style={inputStyle}
              />
            </>
          )}

          <label style={{ ...labelStyle, marginTop: mode === "signup" ? 16 : 0 }}>Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={inputStyle}
            autoComplete="email"
          />

          <label style={{ ...labelStyle, marginTop: 16 }}>Password</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            type="password"
            style={inputStyle}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />

          <button disabled={loading} style={primaryButton}>
            {loading ? "Working…" : mode === "signup" ? "Create account" : "Log in"}
          </button>

          {err && <div style={{ marginTop: 12, color: "#ffb4b4", fontWeight: 800 }}>{err}</div>}
        </form>
      </div>
    </main>
  );
}

const page: CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: 24,
  background:
    "radial-gradient(900px 500px at 30% 10%, rgba(255,95,0,0.35), transparent 55%), radial-gradient(900px 500px at 70% 80%, rgba(5,160,255,0.18), transparent 55%), #070A10",
  color: "white",
};

const card: CSSProperties = {
  width: "min(720px, 92vw)",
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(0,0,0,0.35)",
  boxShadow: "0 20px 80px rgba(0,0,0,0.55)",
  overflow: "hidden",
};

const logo: CSSProperties = {
  width: 54,
  height: 54,
  borderRadius: 16,
  background: "radial-gradient(circle at 30% 30%, #ff7a18, #c2410c 60%, #1f2937 100%)",
  border: "1px solid rgba(255,255,255,0.16)",
};

const pill: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(0,0,0,0.2)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const pillActive: CSSProperties = {
  ...pill,
  background: "rgba(255,95,0,0.35)",
};

const hintBox: CSSProperties = {
  marginTop: 14,
  padding: 12,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(0,0,0,0.22)",
  opacity: 0.92,
  fontSize: 13,
  lineHeight: 1.35,
};

const labelStyle: CSSProperties = {
  display: "block",
  fontWeight: 900,
  marginBottom: 8,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "14px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(0,0,0,0.25)",
  color: "white",
  outline: "none",
  fontSize: 16,
};

const primaryButton: CSSProperties = {
  marginTop: 18,
  width: "100%",
  padding: "14px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "linear-gradient(180deg, rgba(255,95,0,0.9), rgba(255,95,0,0.65))",
  color: "white",
  fontSize: 22,
  fontWeight: 950,
  cursor: "pointer",
};