"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
const [mode, setMode] = useState<"signup" | "login">("login");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const { error } =
      mode === "signup"
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

    if (error) return setError(error.message);

router.replace("/");
  }
async function handleForgotPassword() {
  if (!email) {
    setError("Enter your email above first.");
    return;
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`,
  });

  if (error) {
    setError(error.message);
  } else {
    setError("Password reset email sent. Check your inbox.");
  }
}

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Hudge Survivor Pool</h1>

        <input
          className="w-full border rounded p-2"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="w-full border rounded p-2"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button className="w-full rounded bg-black text-white p-2">
          {mode === "signup" ? "Create account" : "Log in"}
        </button>

        <button
          type="button"
          className="w-full text-sm underline"
          onClick={() => setMode(mode === "signup" ? "login" : "signup")}
        >
          Switch to {mode === "signup" ? "login" : "signup"}
        </button>
        {mode === "login" && (
  <button
    type="button"
    onClick={handleForgotPassword}
    className="w-full text-sm underline"
  >
    Forgot password?
  </button>
)}
      </form>
    </div>
  );
}
