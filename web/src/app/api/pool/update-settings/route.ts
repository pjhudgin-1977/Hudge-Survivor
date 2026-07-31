import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

type Body = {
  poolId: string;
  pool_name: string;
  season_year: number;
  entry_fee_cents: number;
  is_public: boolean;
  max_losses: number;
  rules_text?: string;
};

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createAdminClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const adminSupabase = getAdminSupabase();

    const { data: auth, error: authError } =
      await supabase.auth.getUser();

    if (authError) {
      return NextResponse.json(
        { ok: false, error: authError.message },
        { status: 401 }
      );
    }

    if (!auth?.user) {
      return NextResponse.json(
        { ok: false, error: "Not logged in" },
        { status: 401 }
      );
    }

    let body: Body;

    try {
      body = (await req.json()) as Body;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const poolId = String(body.poolId ?? "").trim();

    if (!poolId) {
      return NextResponse.json(
        { ok: false, error: "Missing poolId" },
        { status: 400 }
      );
    }

    const { data: gateRows, error: gateError } = await adminSupabase
      .from("pool_members")
      .select("is_commissioner, role")
      .eq("pool_id", poolId)
      .eq("user_id", auth.user.id);

    if (gateError) {
      return NextResponse.json(
        { ok: false, error: gateError.message },
        { status: 403 }
      );
    }

    const isCommissioner = (gateRows ?? []).some(
      (row) =>
        Boolean(row?.is_commissioner) ||
        String(row?.role ?? "").toLowerCase() === "commissioner" ||
        String(row?.role ?? "").toLowerCase() === "admin"
    );

    if (!isCommissioner) {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const poolName = String(body.pool_name ?? "").trim();
    const seasonYear = Number(body.season_year ?? 0);
    const entryFeeCents = Math.max(
      0,
      Math.floor(Number(body.entry_fee_cents ?? 0))
    );
    const isPublic = Boolean(body.is_public);
    const maxLosses = Math.max(
      1,
      Math.min(5, Math.floor(Number(body.max_losses ?? 2)))
    );
    const rulesText = String(body.rules_text ?? "").trim();

    if (!poolName) {
      return NextResponse.json(
        { ok: false, error: "Pool name is required" },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(seasonYear) ||
      seasonYear < 2000 ||
      seasonYear > 2100
    ) {
      return NextResponse.json(
        { ok: false, error: "Season year looks invalid" },
        { status: 400 }
      );
    }

    if (rulesText.length < 20) {
      return NextResponse.json(
        {
          ok: false,
          error: "Pool rules must be at least 20 characters.",
        },
        { status: 400 }
      );
    }

    if (rulesText.length > 20000) {
      return NextResponse.json(
        {
          ok: false,
          error: "Pool rules must be 20,000 characters or fewer.",
        },
        { status: 400 }
      );
    }

    const { data: updatedPool, error: updateError } =
      await adminSupabase
        .from("pools")
        .update({
          name: poolName,
          pool_name: poolName,
          season_year: seasonYear,
          entry_fee_cents: entryFeeCents,
          is_public: isPublic,
          max_losses: maxLosses,
          rules_text: rulesText,
        })
        .eq("id", poolId)
        .select("id")
        .maybeSingle();

    if (updateError) {
      return NextResponse.json(
        { ok: false, error: updateError.message },
        { status: 400 }
      );
    }

    if (!updatedPool) {
      return NextResponse.json(
        { ok: false, error: "Pool settings were not updated." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Server error",
      },
      { status: 500 }
    );
  }
}
