"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Member = { screen_name: string; losses: number; is_eliminated: boolean };

export default function PoolDashboard() {
  const params = useParams();
  const poolId = params.poolId as string;

  const [poolName, setPoolName] = useState("");
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    async function loadPool() {
      const { data: poolData, error: poolErr } = await supabase
        .from("pools")
        .select("name")
        .eq("id", poolId)
        .single();

      if (!poolErr && poolData) setPoolName(poolData.name);

      const { data: memberData, error: memberErr } = await supabase
        .from("pool_members")
        .select("screen_name, losses, is_eliminated")
        .eq("pool_id", poolId);

      if (!memberErr && memberData) setMembers(memberData);
    }

    if (poolId) loadPool();
  }, [poolId]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Pool Dashboard</h1>
      <p className="mt-2 text-lg">{poolName}</p>
      <p className="text-sm text-gray-500">Pool ID: {poolId}</p>

      <h2 className="mt-6 text-xl font-semibold">Members</h2>
      <ul className="mt-2 space-y-1">
        {members.map((m) => (
          <li key={m.screen_name} className="border rounded p-2">
            <div className="flex justify-between">
              <span>{m.screen_name}</span>
              <span>
                Losses: {m.losses}
                {m.is_eliminated ? " (Eliminated)" : ""}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

