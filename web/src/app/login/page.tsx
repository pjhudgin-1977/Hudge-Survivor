"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  const sp = useSearchParams();
  const next = useMemo(() => sp.get("next") || "/", [sp]);

  const [mode, setMode] = useState<"signin" | "signup">("signin");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Signup extras
  const [fullName, setFullName] = useState("");
  const [referrer, setReferrer] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
          setErr("Please tell us who referred you.");
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

        // ✅ Force the browser to go exactly where we want next
        window.location.assign(next);
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

      // ✅ Force the browser to go exactly where we want next
      window.location.assign(next);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "radial-gradient(900px 500px at 30% 10%, rgba(255,95,0,0.35), transparent 55%), radial-gradient(900px 500px at 70% 80%, rgba(5,160,255,0.18), transparent 55%), #070A10",
        color: "white",
      }}
    >
      <div
        style={{
          width: "min(720px, 92vw)",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(0,0,0,0.35)",
          boxShadow: "0 20px 80px rgba(0,0,0,0.55)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: 16,
                background:
                  "radial-gradient(circle at 30% 30%, #ff7a18, #c2410c 60%, #1f2937 100%)",
                border: "1px solid rgba(255,255,255,0.16)",
              }}
            />
            <div>
              <div style={{ fontSize: 30, fontWeight: 950, lineHeight: 1.05 }}>
                Hudge Survivor Pool
              </div>
              <div style={{ opacity: 0.85, marginTop: 4 }}>
                Sign in to make picks, sweat games, and survive 🐻
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 18,
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => setMode("signin")}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.18)",
                background:
                  mode === "signin" ? "rgba(255,95,0,0.35)" : "rgba(0,0,0,0.2)",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.18)",
                background:
                  mode === "signup" ? "rgba(255,95,0,0.35)" : "rgba(0,0,0,0.2)",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Create account
            </button>

            <div style={{ marginLeft: "auto", opacity: 0.7, fontSize: 12 }}>
              After login → <span style={{ fontWeight: 900 }}>{next}</span>
            </div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }} />

        <form onSubmit={submit} style={{ padding: 22 }}>
          {mode === "signup" && (
            <>
              <label style={{ display: "block", fontWeight: 900, marginBottom: 8 }}>
                Full name
              </label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Patrick Hudgin"
                style={inputStyle}
                autoComplete="name"
              />

              <label
                style={{
                  display: "block",
                  fontWeight: 900,
                  marginTop: 16,
                  marginBottom: 8,
                }}
              >
                Who referred you?
              </label>
              <input
                value={referrer}
                onChange={(e) => setReferrer(e.target.value)}
                placeholder="Name of commissioner / friend"
                style={inputStyle}
              />
            </>
          )}

          <label
            style={{
              display: "block",
              fontWeight: 900,
              marginTop: mode === "signup" ? 16 : 0,
              marginBottom: 8,
            }}
          >
            Email
          </label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={inputStyle}
            autoComplete="email"
          />

          <label style={{ display: "block", fontWeight: 900, marginTop: 16, marginBottom: 8 }}>
            Password
          </label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            type="password"
            style={inputStyle}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />

          <button
            disabled={loading}
            style={{
              marginTop: 18,
              width: "100%",
              padding: "14px 14px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "linear-gradient(180deg, rgba(255,95,0,0.9), rgba(255,95,0,0.65))",
              color: "white",
              fontSize: 22,
              fontWeight: 950,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.75 : 1,
            }}
          >
            {loading ? "Working…" : mode === "signup" ? "Create account" : "Log in"}
          </button>

          {err && (
            <div style={{ marginTop: 12, color: "#ffb4b4", fontWeight: 800 }}>
              {err}
            </div>
          )}

          <div style={{ marginTop: 14, opacity: 0.75, fontSize: 13, lineHeight: 1.35 }}>
            New here? Use your invite link (like <b>/join/HUDGE-7K9P</b>). You’ll be asked
            to log in or create an account, then you’ll be added automatically.
          </div>
        </form>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(0,0,0,0.25)",
  color: "white",
  outline: "none",
  fontSize: 16,
};