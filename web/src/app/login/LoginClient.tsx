"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "login" | "signup";

export default function LoginClient({ next }: { next: string | null }) {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");

  const [showPw, setShowPw] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [supabase, setSupabase] = useState<any>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const mod = await import("@/lib/supabaseClient");
        const client = mod.createClient();
        if (alive) setSupabase(client);
      } catch (e: any) {
        if (alive) setErr(e?.message || "Failed to initialize auth client.");
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const title = useMemo(
    () => (mode === "login" ? "Sign in" : "Create account"),
    [mode]
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    if (!supabase) {
      setErr("Please wait a second and try again.");
      return;
    }

    setLoading(true);

    if (!email.trim()) {
      setLoading(false);
      setErr("Email is required.");
      return;
    }
    if (!password) {
      setLoading(false);
      setErr("Password is required.");
      return;
    }

    if (mode === "signup") {
      const nick = nickname.trim();
      if (!nick) {
        setLoading(false);
        setErr("Nickname is required.");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { screen_name: nick } },
      });

      setLoading(false);

      if (error) {
        setErr(error.message);
        return;
      }

      if (!data.session) {
        setMsg(
          "Account created! Check your email to confirm, then come back to log in."
        );
        setMode("login");
        return;
      }

      if (next) {
        router.push(next);
        return;
      }

      const { data: member } = await supabase
        .from("pool_members")
        .select("pool_id")
        .limit(1)
        .maybeSingle();

      if (member?.pool_id) router.push(`/pool/${member.pool_id}`);
      else router.push("/dashboard?onboarding=joinonly");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setLoading(false);
      setErr(error.message);
      return;
    }

    if (next) {
      setLoading(false);
      router.push(next);
      return;
    }

    const { data: member } = await supabase
      .from("pool_members")
      .select("pool_id")
      .limit(1)
      .maybeSingle();

    setLoading(false);

    if (member?.pool_id) router.push(`/pool/${member.pool_id}`);
    else router.push("/dashboard?onboarding=joinonly");
  }

  function switchToSignup() {
    setErr(null);
    setMsg(null);
    setMode("signup");
  }

  function switchToLogin() {
    setErr(null);
    setMsg(null);
    setMode("login");
  }

  if (!supabase && !err) {
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
        <div style={{ opacity: 0.85, fontWeight: 900 }}>Loading…</div>
      </main>
    );
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
                {mode === "login"
                  ? "Sign in to make picks, sweat games, and survive 🐻"
                  : "Create your account to join a pool 🐻"}
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: 18 }}>
          {mode === "login" ? (
            <div
              style={{
                marginBottom: 18,
                padding: "14px 14px 15px",
                borderRadius: 16,
                border: "1px solid rgba(255,92,0,0.34)",
                background:
                  "linear-gradient(180deg, rgba(255,92,0,0.18), rgba(255,92,0,0.07))",
                boxShadow: "0 12px 28px rgba(255,92,0,0.12)",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: 0.3,
                  opacity: 0.82,
                  textTransform: "uppercase",
                }}
              >
                New here?
              </div>

              <div
                style={{
                  marginTop: 6,
                  fontSize: 18,
                  fontWeight: 950,
                  lineHeight: 1.25,
                }}
              >
                Create your account first
              </div>

              <div
                style={{
                  marginTop: 6,
                  fontSize: 13,
                  lineHeight: 1.45,
                  opacity: 0.82,
                }}
              >
                New players need to create an account before joining a pool and
                making picks.
              </div>

              <button
                type="button"
                onClick={switchToSignup}
                style={{
                  marginTop: 12,
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background:
                    "linear-gradient(180deg, rgba(255,92,0,1), rgba(255,92,0,0.78))",
                  color: "white",
                  fontWeight: 950,
                  letterSpacing: 0.2,
                  cursor: "pointer",
                  boxShadow: "0 12px 30px rgba(255,92,0,0.22)",
                }}
              >
                Create Account
              </button>

              <div
                style={{
                  marginTop: 8,
                  textAlign: "center",
                  fontSize: 12,
                  opacity: 0.76,
                }}
              >
                Already signed up? Use the sign in form below.
              </div>
            </div>
          ) : (
            <div
              style={{
                marginBottom: 18,
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.04)",
              }}
            >
              <div style={{ fontSize: 13, lineHeight: 1.45, opacity: 0.84 }}>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={switchToLogin}
                  style={linkBtnStyle}
                >
                  Log in here
                </button>
                .
              </div>
            </div>
          )}

          <form onSubmit={onSubmit}>
            <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 12 }}>
              {title}
            </div>

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

            {mode === "signup" ? (
              <>
                <label style={labelStyle}>Nickname</label>
                <input
                  style={inputStyle}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="What should we call you?"
                  autoComplete="nickname"
                />
                <div style={{ height: 12 }} />
              </>
            ) : null}

            <label style={labelStyle}>Password</label>

            <div style={{ position: "relative" }}>
              <input
                style={{ ...inputStyle, paddingRight: 44 }}
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
              />

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Hide password" : "Show password"}
                title={showPw ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(0,0,0,0.20)",
                  color: "rgba(255,255,255,0.92)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  lineHeight: 1,
                }}
              >
                {showPw ? "🙈" : "👁️"}
              </button>
            </div>

            {mode === "login" ? (
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  onClick={() => router.push("/reset-password")}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "rgba(255,255,255,0.78)",
                    textDecoration: "underline",
                    fontWeight: 800,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Forgot password?
                </button>
              </div>
            ) : null}

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

            {msg ? (
              <div
                style={{
                  marginTop: 12,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,255,140,0.35)",
                  background: "rgba(0,255,140,0.10)",
                  color: "rgba(220,255,235,0.95)",
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                {msg}
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
                  : mode === "login"
                    ? "rgba(255,255,255,0.08)"
                    : "linear-gradient(180deg, rgba(255,92,0,0.95), rgba(255,92,0,0.72))",
                color: "white",
                fontWeight: 950,
                letterSpacing: 0.2,
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow:
                  loading || mode === "login"
                    ? "none"
                    : "0 12px 30px rgba(255,92,0,0.22)",
              }}
            >
              {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
            </button>

            <div
              style={{
                marginTop: 14,
                fontSize: 12,
                opacity: 0.75,
                lineHeight: 1.4,
              }}
            >
              {mode === "login" ? (
                <>
                  Need a new account?{" "}
                  <button
                    type="button"
                    onClick={switchToSignup}
                    style={linkBtnStyle}
                  >
                    Create one here
                  </button>
                  .
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={switchToLogin}
                    style={linkBtnStyle}
                  >
                    Log in
                  </button>
                  .
                </>
              )}
            </div>
          </form>
        </div>
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

const linkBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "rgba(255,255,255,0.92)",
  textDecoration: "underline",
  fontWeight: 900,
  cursor: "pointer",
  padding: 0,
};