"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function CreatePoolPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string>("");
  const [screenName, setScreenName] = useState("");
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;

      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);

      // ✅ Gate: user must already be a member of at least 1 pool
      const { count, error } = await supabase
        .from("pool_members")
        .select("pool_id", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (error) {
        // If something weird happens, fail closed (no pool creation)
        setBlocked(true);
        router.replace("/dashboard?onboarding=joinonly");
        return;
      }

      const memberCount = Number(count ?? 0);
      if (memberCount <= 0) {
        setBlocked(true);
        router.replace("/dashboard?onboarding=joinonly");
        return;
      }

      setBlocked(false);
    })();
  }, [router]);

  async function createPool() {
    if (!userId) return;
    setLoading(true);

    try {
      const res = await fetch("/api/pools/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Hudge Survivor Pool 2025",
          seasonYear: 2025,
          screenName,
          userId,
        }),
      });

      const data = await res.json();

      if (data.poolId) {
        alert("Pool created!");
        router.push(`/pool/${data.poolId}`);
      } else {
        alert(data.error || "Error creating pool");
      }
    } finally {
      setLoading(false);
    }
  }

  // While redirecting / checking, keep it quiet
  if (blocked) return null;

  return (
    <div className="p-6 space-y-4 max-w-xl">
      <h1 className="text-2xl font-semibold">Create Pool</h1>

      <div className="opacity-70 text-sm">
        Pool creation is limited. If you were redirected here by mistake, go back to the dashboard.
      </div>

      <input
        className="border p-2 w-full"
        placeholder="Your screen name"
        value={screenName}
        onChange={(e) => setScreenName(e.target.value)}
      />

      <button
        className="bg-black text-white px-4 py-2 disabled:opacity-60"
        onClick={createPool}
        disabled={loading || !screenName.trim()}
      >
        {loading ? "Creating..." : "Create Pool"}
      </button>
    </div>
  );
}