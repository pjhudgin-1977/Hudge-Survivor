import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import JoinEntryForm from "./JoinEntryForm";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

function isInviteCode(v: string) {
  return /^HUDGE-[A-Z0-9]{4}$/i.test(v);
}

function nextEntryNo(rows: Array<{ entry_no: number | null }>) {
  const used = new Set(
    rows
      .map((r) => Number(r.entry_no))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 3)
  );

  for (const n of [1, 2, 3]) {
    if (!used.has(n)) return n;
  }

  return null;
}

export default async function JoinPoolPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const supabase = await createClient();
  const { poolId: tokenRaw } = await params;

  const token = String(tokenRaw || "").trim();
  const tokenUpper = token.toUpperCase();

  let poolId: string | null = null;

  if (isUuid(token)) {
    poolId = token;
  } else if (isInviteCode(tokenUpper)) {
    const { data: invite, error: inviteError } = await supabase
      .from("invite_codes")
      .select("pool_id, is_active, expires_at, max_uses, uses_count")
      .eq("code", tokenUpper)
      .maybeSingle();

    if (inviteError) {
      return (
        <main style={{ padding: 24, maxWidth: 720 }}>
          <h1 style={{ fontSize: 26, fontWeight: 950 }}>Join Pool</h1>
          <p style={{ marginTop: 10 }}>Could not validate invite link.</p>
          <pre style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>
            {inviteError.message}
          </pre>
        </main>
      );
    }

    const expired =
      invite?.expires_at != null &&
      new Date(invite.expires_at).getTime() <= Date.now();

    const outOfUses =
      invite?.max_uses != null &&
      invite?.uses_count != null &&
      invite.uses_count >= invite.max_uses;

    if (!invite || invite.is_active === false || expired || outOfUses) {
      return (
        <main style={{ padding: 24, maxWidth: 720 }}>
          <h1 style={{ fontSize: 26, fontWeight: 950 }}>Join Pool</h1>
          <p style={{ marginTop: 10 }}>Invalid or expired invite link.</p>
          <p style={{ marginTop: 10 }}>
            Ask the commissioner for a fresh invite link.
          </p>
        </main>
      );
    }

    poolId = invite.pool_id;
  } else {
    return (
      <main style={{ padding: 24, maxWidth: 720 }}>
        <h1 style={{ fontSize: 26, fontWeight: 950 }}>Join Pool</h1>
        <p style={{ marginTop: 10 }}>Invalid invite link.</p>
        <div style={{ marginTop: 14 }}>
          <Link href="/login" style={{ textDecoration: "underline" }}>
            Go to login
          </Link>
        </div>
      </main>
    );
  }

  const { data: auth } = await supabase.auth.getUser();

  if (!auth?.user) {
    redirect(`/login?next=/join/${tokenUpper}`);
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("pool_members")
    .select("entry_no")
    .eq("pool_id", poolId)
    .eq("user_id", auth.user.id)
    .order("entry_no", { ascending: true });

  if (existingError) {
    return (
      <main style={{ padding: 24, maxWidth: 720 }}>
        <h1 style={{ fontSize: 26, fontWeight: 950 }}>Join Pool</h1>
        <p style={{ marginTop: 10 }}>Could not check membership.</p>
        <pre style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>
          {existingError.message}
        </pre>
      </main>
    );
  }

  const newEntryNo = nextEntryNo(existingRows ?? []);

  if (newEntryNo == null) {
    return (
      <main style={{ padding: 24, maxWidth: 720 }}>
        <h1 style={{ fontSize: 26, fontWeight: 950 }}>Join Pool</h1>
        <p style={{ marginTop: 10 }}>
          You already have the maximum of 3 entries in this pool.
        </p>
        <div style={{ marginTop: 14 }}>
          <Link href={`/pool/${poolId}`} style={{ textDecoration: "underline" }}>
            Go to pool
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1 style={{ fontSize: 26, fontWeight: 950 }}>Join Pool</h1>

      <p style={{ marginTop: 10, opacity: 0.85 }}>
        Choose the name other players will see.
      </p>

      <JoinEntryForm poolId={poolId!} entryNo={newEntryNo} />
    </main>
  );
}
