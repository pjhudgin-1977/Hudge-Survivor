"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

export default function CreatePoolPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [poolName, setPoolName] = useState("");
  const [seasonYear, setSeasonYear] = useState("2026");
  const [screenName, setScreenName] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const supabase = createClient();

    async function checkAccess() {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);

      const { count, error } = await supabase
        .from("pool_members")
        .select("pool_id", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (error || Number(count ?? 0) <= 0) {
        setBlocked(true);
        router.replace("/dashboard");
        return;
      }

      setBlocked(false);
      setCheckingAccess(false);
    }

    checkAccess();
  }, [router]);

  async function createPool() {
    setErrorMessage("");

    const cleanPoolName = poolName.trim();
    const cleanScreenName = screenName.trim();
    const parsedSeasonYear = Number(seasonYear);

    if (!userId) {
      setErrorMessage("Your login could not be confirmed. Please refresh.");
      return;
    }

    if (cleanPoolName.length < 3 || cleanPoolName.length > 60) {
      setErrorMessage("Pool name must be between 3 and 60 characters.");
      return;
    }

    if (cleanScreenName.length < 2 || cleanScreenName.length > 30) {
      setErrorMessage("Screen name must be between 2 and 30 characters.");
      return;
    }

    if (
      !Number.isInteger(parsedSeasonYear) ||
      parsedSeasonYear < 2026 ||
      parsedSeasonYear > 2035
    ) {
      setErrorMessage("Enter a valid season year between 2026 and 2035.");
      return;
    }

    if (confirmation.trim().toUpperCase() !== "CREATE") {
      setErrorMessage('Type CREATE to confirm that you want to create this pool.');
      return;
    }

    const confirmed = window.confirm(
      `Create "${cleanPoolName}" for the ${parsedSeasonYear} season?\n\nThis will create a new survivor pool and make you its commissioner.`
    );

    if (!confirmed) return;

    setLoading(true);

    try {
      const response = await fetch("/api/pools/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: cleanPoolName,
          seasonYear: parsedSeasonYear,
          screenName: cleanScreenName,
          userId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.poolId) {
        setErrorMessage(data.error || "The pool could not be created.");
        return;
      }

      router.push(`/pool/${data.poolId}`);
      router.refresh();
    } catch {
      setErrorMessage("The pool could not be created. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (blocked || checkingAccess) {
    return null;
  }

  const canCreate =
    poolName.trim().length >= 3 &&
    screenName.trim().length >= 2 &&
    confirmation.trim().toUpperCase() === "CREATE" &&
    !loading;

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <section className="mx-auto max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-lg">
        <h1 className="text-3xl font-bold text-white">Create a Pool</h1>

        <p className="mt-2 text-sm text-slate-300">
          Creating a pool makes you its commissioner. Review the information
          carefully before confirming.
        </p>

        <div className="mt-6 space-y-5">
          <label className="block">
            <span className="mb-2 block font-bold text-white">Pool name</span>

            <input
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 placeholder:text-slate-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              placeholder="Example: Hudge Survivor Pool 2026"
              value={poolName}
              maxLength={60}
              onChange={(event) => setPoolName(event.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-2 block font-bold text-white">
              Season year
            </span>

            <input
              type="number"
              min="2026"
              max="2035"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              value={seasonYear}
              onChange={(event) => setSeasonYear(event.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-2 block font-bold text-white">
              Your screen name
            </span>

            <input
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 placeholder:text-slate-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              placeholder="Your name in this pool"
              value={screenName}
              maxLength={30}
              onChange={(event) => setScreenName(event.target.value)}
            />
          </label>

          <label className="block rounded-xl border border-amber-400/40 bg-amber-400/5 p-4">
            <span className="block font-bold text-amber-300">
              Creation confirmation
            </span>

            <span className="mt-1 block text-sm text-slate-300">
              Type <strong className="text-white">CREATE</strong> below. You
              will receive one final confirmation before the pool is created.
            </span>

            <input
              className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 placeholder:text-slate-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              placeholder="Type CREATE"
              value={confirmation}
              autoComplete="off"
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>

          {errorMessage ? (
            <div className="rounded-lg border border-red-400/40 bg-red-400/10 p-3 font-semibold text-red-200">
              {errorMessage}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-lg bg-orange-500 px-5 py-2 font-bold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
              onClick={createPool}
              disabled={!canCreate}
            >
              {loading ? "Creating Pool…" : "Create Pool"}
            </button>

            <button
              type="button"
              className="rounded-lg border border-slate-500 bg-slate-700 px-5 py-2 font-bold text-white transition hover:bg-slate-600"
              onClick={() => router.push("/dashboard")}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}