import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import JoinEntryForm from "./JoinEntryForm";

function isInviteCode(value: string) {
  return /^HUDGE-[A-Z0-9]{4}$/i.test(value);
}

function nextEntryNo(rows: Array<{ entry_no: number | null }>) {
  const used = new Set(
    rows
      .map((row) => Number(row.entry_no))
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
  const { poolId: rawCode } = await params;

  const inviteCode = String(rawCode || "").trim().toUpperCase();

  if (!isInviteCode(inviteCode)) {
    return (
      <main style={{ padding: 24, maxWidth: 720 }}>
        <h1 style={{ fontSize: 26, fontWeight: 950 }}>Join Pool</h1>
        <p style={{ marginTop: 10 }}>
          A valid HUDGE invite code is required.
        </p>
        <div style={{ marginTop: 14 }}>
          <Link href="/join" style={{ textDecoration: "underline" }}>
            Enter an invite code
          </Link>
        </div>
      </main>
    );
  }

  const { data: previewRows, error: previewError } = await supabase.rpc(
    "get_pool_preview_by_code",
    {
      p_code: inviteCode,
    }
  );

  if (previewError) {
    return (
      <main style={{ padding: 24, maxWidth: 720 }}>
        <h1 style={{ fontSize: 26, fontWeight: 950 }}>Join Pool</h1>
        <p style={{ marginTop: 10 }}>Could not validate invite link.</p>
        <pre style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>
          {previewError.message}
        </pre>
      </main>
    );
  }

  const preview = Array.isArray(previewRows) ? previewRows[0] : previewRows;

  if (!preview?.pool_id) {
    return (
      <main style={{ padding: 24, maxWidth: 720 }}>
        <h1 style={{ fontSize: 26, fontWeight: 950 }}>Join Pool</h1>
        <p style={{ marginTop: 10 }}>Invalid or expired invite link.</p>
        <p style={{ marginTop: 10 }}>
          Try entering your invite code manually.
        </p>
        <div style={{ marginTop: 14 }}>
          <Link href="/join" style={{ textDecoration: "underline" }}>
            Enter invite code manually
          </Link>
        </div>
      </main>
    );
  }

  const { data: auth } = await supabase.auth.getUser();

  if (!auth?.user) {
    redirect(`/login?next=/join/${inviteCode}`);
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("pool_members")
    .select("entry_no")
    .eq("pool_id", preview.pool_id)
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

  if ((existingRows ?? []).length > 0) {
    redirect(`/pool/${preview.pool_id}`);
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
          <Link
            href={`/pool/${preview.pool_id}`}
            style={{ textDecoration: "underline" }}
          >
            Go to pool
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1 style={{ fontSize: 26, fontWeight: 950 }}>
        Join {preview.pool_name}
      </h1>

      <p style={{ marginTop: 10, opacity: 0.85 }}>
        Commissioner: {preview.commissioner_name}
      </p>

      <p style={{ marginTop: 10, opacity: 0.85 }}>
        Choose the name other players will see.
      </p>

      <JoinEntryForm
        poolId={preview.pool_id}
        inviteCode={inviteCode}
        entryNo={newEntryNo}
      />
    </main>
  );
}
