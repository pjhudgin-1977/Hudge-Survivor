import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CopyButton from "@/app/_components/CopyButton";

export default async function PoolHomePage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const supabase = await createClient();
  const { poolId } = await params;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login");

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.VERCEL_URL?.startsWith("http")
    ? process.env.VERCEL_URL
    : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

const inviteUrl = `${siteUrl}/join/${poolId}`;
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Pool Home</h1>

      <div className="opacity-70">
        Pool: <code>{poolId}</code>
      </div>

      {/* Invite box */}
      <div className="rounded-xl border p-4 space-y-2">
        <div className="font-semibold">Invite someone</div>
        <div className="text-sm opacity-70">
          Share this link. It will add them to your pool after they log in.
        </div>
        <code className="block rounded-lg border p-2 text-sm overflow-x-auto">
          {inviteUrl}
        </code>
        <CopyButton text={inviteUrl} />
        <div className="text-sm opacity-70">
          (For now it’s a relative link. We’ll make it a full copyable URL next.)
        </div>
      </div>

      <div className="grid gap-3">
        <Link className="rounded-xl border p-4 hover:bg-white/5" href={`/pool/${poolId}/pick`}>
          <div className="font-semibold">Make Pick</div>
          <div className="text-sm opacity-70">Choose your team for this week</div>
        </Link>

        <Link className="rounded-xl border p-4 hover:bg-white/5" href={`/pool/${poolId}/sweat`}>
          <div className="font-semibold">Sweat</div>
          <div className="text-sm opacity-70">Live view of picks and game status</div>
        </Link>

        <Link className="rounded-xl border p-4 hover:bg-white/5" href={`/pool/${poolId}/standings`}>
          <div className="font-semibold">Standings</div>
          <div className="text-sm opacity-70">Who’s alive / eliminated</div>
        </Link>
      </div>
    </main>
  );
}