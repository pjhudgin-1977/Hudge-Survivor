"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function AppHome() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [poolId, setPoolId] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push("/login");
      else setEmail(data.user.email ?? null);
      setLoading(false);
    });
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function goToPool() {
    if (!poolId.trim()) return;
    router.push("/app/pool/" + poolId.trim());
  }

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p>Logged in as: {email}</p>
      </div>

      <div className="border rounded p-4 space-y-3">
        <h2 className="text-xl font-semibold">Join a Pool</h2>
        <input
          className="border p-2 w-full"
          placeholder="Paste Pool ID here"
          value={poolId}
          onChange={(e) => setPoolId(e.target.value)}
        />
        <button className="bg-black text-white px-4 py-2" onClick={goToPool}>
          Go to Pool
        </button>
      </div>

      <button className="rounded bg-black text-white px-4 py-2" onClick={logout}>
        Log out
      </button>
    </div>
  );
}

