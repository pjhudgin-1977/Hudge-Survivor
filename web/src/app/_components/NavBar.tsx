"use client";

import Link from "next/link";
import { useParams, useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";

export default function NavBar({
  status,
  label,
}: {
  status: "OPEN" | "LOCKED";
  label?: string;
}) {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [screenName, setScreenName] = useState("");

  const poolId = params.poolId as string | undefined;

  useEffect(() => {
    async function loadUser() {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;

      if (!userId || !poolId) return;

      const { data } = await supabase
        .from("pool_members")
        .select("screen_name")
        .eq("user_id", userId)
        .eq("pool_id", poolId)
        .maybeSingle();

      if (data?.screen_name) setScreenName(data.screen_name);
    }

    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolId]);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (!poolId) return null;

  function linkClass(path: string) {
    const active = pathname === path;

    return `
      font-semibold
      ${active ? "text-[var(--bears-orange)]" : "text-white"}
      hover:text-[var(--bears-orange)]
    `;
  }

  return (
    <nav
      style={{ backgroundColor: "var(--bears-navy)" }}
      className="flex items-center gap-6 px-6 py-4 text-sm border-b"
    >
      <Link href={`/pool/${poolId}`} className={linkClass(`/pool/${poolId}`)}>
        🏠 Dashboard
      </Link>

      <Link
        href={`/pool/${poolId}/pick`}
        className={linkClass(`/pool/${poolId}/pick`)}
      >
        ✅ Pick
      </Link>

      <Link
        href={`/pool/${poolId}/sweat`}
        className={linkClass(`/pool/${poolId}/sweat`)}
      >
        🔥 Sweat
      </Link>

      <Link
        href={`/pool/${poolId}/standings`}
        className={linkClass(`/pool/${poolId}/standings`)}
      >
        📊 Standings
      </Link>

      <div
        className={`px-2 py-1 rounded-md text-xs font-semibold border ${
          status === "LOCKED"
            ? "border-[var(--bears-orange)] text-[var(--bears-orange)]"
            : "border-white/30 text-white/80"
        }`}
      >
        {status === "LOCKED" ? "🔒 LOCKED" : "✅ OPEN"}
        {label ? ` — ${label}` : ""}
      </div>

      <div className="ml-auto flex items-center gap-4">
        <span className="text-white/80 font-medium">👤 {screenName}</span>

        <button
          onClick={logout}
          className="px-3 py-1 rounded-md border border-white/30 text-white hover:bg-[var(--bears-orange)] hover:text-white transition"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}