import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

export async function POST(
  req: Request,
  { params }: { params: Promise<{ poolId: string }> }
) {
  const supabase = await createClient();
  const { poolId } = await params;

  const { data: auth } = await supabase.auth.getUser();

  if (!auth?.user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const body = await req.json();
  const screenName = String(body.screen_name || "").trim();

  if (screenName.length < 2) {
    return NextResponse.json(
      { error: "Screen name must be at least 2 characters." },
      { status: 400 }
    );
  }

  if (screenName.length > 30) {
    return NextResponse.json(
      { error: "Screen name must be 30 characters or fewer." },
      { status: 400 }
    );
  }

  const { data: pool, error: poolError } = await supabase
    .from("pools")
    .select("id")
    .eq("id", poolId)
    .maybeSingle();

  if (poolError) {
    return NextResponse.json({ error: poolError.message }, { status: 400 });
  }

  if (!pool) {
    return NextResponse.json({ error: "Pool not found." }, { status: 404 });
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("pool_members")
    .select("entry_no")
    .eq("pool_id", poolId)
    .eq("user_id", auth.user.id)
    .order("entry_no", { ascending: true });

  if (existingError) {
    return NextResponse.json(
      { error: existingError.message },
      { status: 400 }
    );
  }

  const entryNo = nextEntryNo(existingRows ?? []);

  if (entryNo == null) {
    return NextResponse.json(
      { error: "You already have the maximum of 3 entries in this pool." },
      { status: 400 }
    );
  }

  const finalScreenName =
    entryNo === 1 ? screenName : `${screenName} (Entry ${entryNo})`;

  const { error: joinError } = await supabase.from("pool_members").insert({
    pool_id: poolId,
    user_id: auth.user.id,
    entry_no: entryNo,
    screen_name: finalScreenName,
    role: "member",
    is_commissioner: false,
    losses: 0,
    is_eliminated: false,
  });

  if (joinError) {
    return NextResponse.json({ error: joinError.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    entry_no: entryNo,
    screen_name: finalScreenName,
  });
}
