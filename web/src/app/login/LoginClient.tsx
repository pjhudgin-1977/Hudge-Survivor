"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "login" | "signup";

function safeNextPath(next: string | null) {
  const value = String(next ?? "").trim();

  if (!value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  return value;
}

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

  const safeNext = useMemo(() => safeNextPath(next), [next]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const mod = await import("@/lib/supabaseClient");
        const client = mod.createClient();

        if (alive) {
          setSupabase(client);
        }
      } catch (error: unknown) {
        if (!alive) return;

        setErr(
          error instanceof Error
            ? error.message
            : "Failed to initialize auth client."
        );
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

  async function goToMemberDestination() {
    if (safeNext) {
      router.push(safeNext);
      return;
    }

    const { data: member } = await supabase
      .from("pool_members")
      .select("pool_id")
      .limit(1)
      .maybeSingle();

    if (member?.pool_id) {
      router.push(`/pool/${member.pool_id}`);
    } else {
      router.push("/dashboard?onboarding=joinonly");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    setErr(null);
    setMsg(null);

    if (!supabase) {
      setErr("Please wait a second and try again.");
      return;
    }

    const emailAddress = email.trim();

    if (!emailAddress) {
      setErr("Email is required.");
      return;
    }

    if (mode === "signup") {
      setLoading(true);

      try {
        const response = await fetch("/api/auth/email-exists", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: emailAddress,
          }),
        });

        const result = await response.json();

        if (!response.ok || !result?.ok) {
          setLoading(false);
          setErr(result?.error ?? "Could not check email. Please try again.");
          return;
        }

        if (result.exists) {
          setLoading(false);
          setErr(
            "An account already exists for this email. Please sign in or reset your password."
          );
          return;
        }
      } catch {
        setLoading(false);
        setErr("Could not check email. Please try again.");
        return;
      }
    }

    if (!password) {
      setErr("Password is required.");
      return;
    }

    setLoading(true);

    if (mode === "signup") {
      const screenName = nickname.trim();

      if (!screenName) {
        setLoading(false);
        setErr("Screen name is required.");
        return;
      }

      if (screenName.length < 2) {
        setLoading(false);
        setErr("Screen name must be at least 2 characters.");
        return;
      }

      if (screenName.length > 30) {
        setLoading(false);
        setErr("Screen name must be 30 characters or fewer.");
        return;
      }

      const confirmationDestination =
        safeNext ?? "/dashboard?onboarding=joinonly";

      const emailRedirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(
              confirmationDestination
            )}`
          : undefined;

      const { data, error } = await supabase.auth.signUp({
        email: emailAddress,
        password,
        options: {
          emailRedirectTo,
          data: {
            screen_name: screenName,
          },
        },
      });

      setLoading(false);

      if (error) {
        setErr(error.message);
        return;
      }


        if (data.user && data.user.identities?.length === 0) {
          setErr(
            "An account already exists for this email. Please sign in or reset your password."
          );
          return;
        }

      if (!data.session) {
        setMsg(
          safeNext
            ? "Account created! Check your email and click the confirmation link. You’ll return automatically to this pool to finish joining."
            : "Account created! Check your email and click the confirmation link to continue."
        );
        return;
      }

      await goToMemberDestination();
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: emailAddress,
      password,
    });

    if (error) {
      setLoading(false);
      setErr(error.message);
      return;
    }

    setLoading(false);
    await goToMemberDestination();
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
      <main style={mainStyle}>
        <div style={{ opacity: 0.85, fontWeight: 900 }}>Loading…</div>
      </main>
    );
  }

  return (
    <main style={mainStyle}>
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div aria-hidden style={logoStyle} />

            <div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 950,
                  letterSpacing: 0.2,
                }}
              >
                Hudge Survivor Pool
              </div>

              <div style={{ fontSize: 13, opacity: 0.78, marginTop: 2 }}>
                {mode === "login"
                  ? "Join the pool, make picks, sweat games, and survive 🐻"
                  : "Create your account to join a pool 🐻"}
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: 18 }}>
          {safeNext?.startsWith("/join/") ? (
            <div
              style={{
                marginBottom: 16,
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid rgba(249,115,22,0.45)",
                background: "rgba(249,115,22,0.12)",
                fontSize: 14,
                fontWeight: 850,
                lineHeight: 1.45,
              }}
            >
              You’ve been invited to join the Hudge Survivor Pool. Sign in or create an account below to continue.
            </div>
          ) : null}

          {mode === "login" ? (
            <div style={existingUserBoxStyle}>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 950,
                  lineHeight: 1.25,
                }}
              >
                Already joined?
              </div>

              <div
                style={{
                  marginTop: 6,
                  fontSize: 13,
                  lineHeight: 1.45,
                  opacity: 0.88,
                }}
              >
                Sign in below to get back to your pool and make your picks.
              </div>
            </div>
          ) : (
            <div style={existingUserBoxStyle}>
              <div style={{ fontSize: 13, lineHeight: 1.45, opacity: 0.84 }}>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={switchToLogin}
                  style={linkBtnStyle}
                >
                  Sign in
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
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
              disabled={loading}
            />

            <div style={{ height: 12 }} />

            {mode === "signup" ? (
              <>
                <label style={labelStyle}>Screen name</label>

                <input
                  style={inputStyle}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="What should other players call you?"
                  autoComplete="nickname"
                  maxLength={30}
                  disabled={loading}
                />

                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    lineHeight: 1.4,
                    opacity: 0.7,
                  }}
                >
                  We’ll carry this screen name into the pool signup form for
                  you.
                </div>

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
                disabled={loading}
              />

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowPw((value) => !value)}
                aria-label={showPw ? "Hide password" : "Show password"}
                title={showPw ? "Hide password" : "Show password"}
                style={passwordToggleStyle}
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
                  onClick={() => router.push("/reset-password?mode=request")}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "rgba(255,255,255,0.78)",
                    textDecoration: "underline",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Forgot password?
                </button>
              </div>
            ) : null}

            {err ? <div style={errorStyle}>{err}</div> : null}

            {msg ? <div style={messageStyle}>{msg}</div> : null}

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
              {loading
                ? "Please wait…"
                : mode === "login"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>

          {mode === "login" ? (
            <div style={newUserBoxStyle}>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 950,
                  lineHeight: 1.25,
                }}
              >
                New here?
              </div>

              <div
                style={{
                  marginTop: 6,
                  fontSize: 13,
                  lineHeight: 1.45,
                  opacity: 0.82,
                }}
              >
                Create an account only if this is your first time joining the pool.
              </div>

              <button
                type="button"
                onClick={switchToSignup}
                style={createAccountButtonStyle}
              >
                Create Account
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

const mainStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: 20,
  background:
    "radial-gradient(1200px 600px at 20% 0%, rgba(255,92,0,0.18), transparent 60%), radial-gradient(900px 500px at 100% 10%, rgba(255,255,255,0.10), transparent 55%), linear-gradient(180deg, #050A14 0%, #050812 45%, #04060F 100%)",
  color: "white",
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 430,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(10, 14, 28, 0.72)",
  boxShadow: "0 18px 60px rgba(0,0,0,0.55)",
  overflow: "hidden",
};

const headerStyle: React.CSSProperties = {
  padding: "18px 18px 16px",
  borderBottom: "1px solid rgba(255,255,255,0.10)",
  background:
    "linear-gradient(180deg, rgba(255,92,0,0.14), rgba(255,92,0,0.02))",
};

const logoStyle: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.16)",
  background:
    "radial-gradient(circle at 30% 30%, rgba(255,92,0,0.9), rgba(255,92,0,0.15))",
  boxShadow: "0 10px 25px rgba(255,92,0,0.18)",
};

const newUserBoxStyle: React.CSSProperties = {
  marginTop: 18,
  marginBottom: 18,
  padding: "14px 14px 15px",
  borderRadius: 16,
  border: "1px solid rgba(255,92,0,0.34)",
  background:
    "linear-gradient(180deg, rgba(255,92,0,0.18), rgba(255,92,0,0.07))",
  boxShadow: "0 12px 28px rgba(255,92,0,0.12)",
};

const existingUserBoxStyle: React.CSSProperties = {
  marginBottom: 18,
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
};

const createAccountButtonStyle: React.CSSProperties = {
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
};

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

const passwordToggleStyle: React.CSSProperties = {
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
};

const errorStyle: React.CSSProperties = {
  marginTop: 12,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,70,70,0.35)",
  background: "rgba(255,70,70,0.10)",
  color: "rgba(255,210,210,0.95)",
  fontSize: 13,
  fontWeight: 800,
};

const messageStyle: React.CSSProperties = {
  marginTop: 12,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(0,255,140,0.35)",
  background: "rgba(0,255,140,0.10)",
  color: "rgba(220,255,235,0.95)",
  fontSize: 13,
  fontWeight: 800,
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
