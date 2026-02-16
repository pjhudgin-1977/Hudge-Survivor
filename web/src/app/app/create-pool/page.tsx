"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function CreatePoolPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string>("");
  const [screenName, setScreenName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push("/login");
      else setUserId(data.user.id);
    });
  }, [router]);

  async function createPool() {
    setLoading(true);

    const res = await fetch("/api/pools/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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
router.push("/app/pool/" + data.poolId);
    } else {
alert(data.error || "Error creating pool");
    }

    setLoading(false);
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Create Pool</h1>

      <input
        className="border p-2 w-full"
        placeholder="Your screen name"
        value={screenName}
        onChange={(e) => setScreenName(e.target.value)}
      />

      <button
        className="bg-black text-white px-4 py-2"
        onClick={createPool}
        disabled={loading}
      >
        {loading ? "Creating..." : "Create Pool"}
      </button>
    </div>
  );
}

