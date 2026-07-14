import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return createAdminClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
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

export async function POST(
  req: Request,
  { params }: { params: Promise<{ poolId: string }> }
) {
  try {
    const supabase = await createClient();
    const adminSupabase = getAdminSupabase();
    const { poolId } = await params;

    const { data: auth, error: authError } =
      await supabase.auth.getUser();

    if (authError || !auth?.user) {
      return NextResponse.json(
        { error: "Not logged in" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const fullName = String(body.full_name || "").trim();
    const screenName = String(body.screen_name || "").trim();

    if (fullName.length < 2) {
      return NextResponse.json(
        { error: "Full name must be at least 2 characters." },
        { status: 400 }
      );
    }

    if (fullName.length > 100) {
      return NextResponse.json(
        { error: "Full name must be 100 characters or fewer." },
        { status: 400 }
      );
    }

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

    const { data: pool, error: poolError } = await adminSupabase
      .from("pools")
      .select("id")
      .eq("id", poolId)
      .maybeSingle();

    if (poolError) throw poolError;

    if (!pool) {
      return NextResponse.json(
        { error: "Pool not found." },
        { status: 404 }
      );
    }

    const { data: existingProfile, error: profileReadError } =
      await adminSupabase
        .from("profiles")
        .select("user_id")
        .eq("user_id", auth.user.id)
        .maybeSingle();

    if (profileReadError) throw profileReadError;

    if (existingProfile) {
      const { error: profileUpdateError } = await adminSupabase
        .from("profiles")
        .update({
          email: auth.user.email ?? null,
          full_name: fullName,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", auth.user.id);

      if (profileUpdateError) throw profileUpdateError;
    } else {
      const { error: profileInsertError } = await adminSupabase
        .from("profiles")
        .insert({
          user_id: auth.user.id,
          email: auth.user.email ?? null,
          full_name: fullName,
          referred_by: null,
        });

      if (profileInsertError) throw profileInsertError;
    }

    const { data: existingRows, error: existingError } =
      await adminSupabase
        .from("pool_members")
        .select("entry_no")
        .eq("pool_id", poolId)
        .eq("user_id", auth.user.id)
        .order("entry_no", { ascending: true });

    if (existingError) throw existingError;

    const entryNo = nextEntryNo(existingRows ?? []);

    if (entryNo == null) {
      return NextResponse.json(
        {
          error:
            "You already have the maximum of 3 entries in this pool.",
        },
        { status: 400 }
      );
    }

    const finalScreenName =
      entryNo === 1
        ? screenName
        : `${screenName} (Entry ${entryNo})`;

    const { error: joinError } = await adminSupabase
      .from("pool_members")
      .insert({
        pool_id: poolId,
        user_id: auth.user.id,
        entry_no: entryNo,
        screen_name: finalScreenName,
        role: "member",
        is_commissioner: false,
        losses: 0,
        is_eliminated: false,
      });

    if (joinError) throw joinError;

    return NextResponse.json({
      ok: true,
      entry_no: entryNo,
      screen_name: finalScreenName,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
