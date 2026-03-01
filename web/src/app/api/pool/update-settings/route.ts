import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Body = {
  poolId: string;
  pool_name: string;
  season_year: number;
  entry_fee_cents: number;
  is_public: boolean;
  max_losses: number;
};

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: 401 });
    if (!auth?.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const poolId = String(body.poolId ?? "").trim();
    if (!poolId) {
      return NextResponse.json({ ok: false, error: "Missing poolId" }, { status: 400 });
    }

    // Commissioner gate (same pattern as your other admin actions)
    const { data: gate, error: gateErr } = await supabase
      .from("pool_members")
      .select("is_commissioner")
      .eq("pool_id", poolId)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (gateErr) return NextResponse.json({ ok: false, error: gateErr.message }, { status: 403 });
    if (!gate?.is_commissioner) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

    // Basic validation
    const pool_name = String(body.pool_name ?? "").trim();
    const season_year = Number(body.season_year ?? 0);
    const entry_fee_cents = Math.max(0, Math.floor(Number(body.entry_fee_cents ?? 0)));
    const is_public = Boolean(body.is_public);
    const max_losses = Math.max(1, Math.min(5, Math.floor(Number(body.max_losses ?? 2))));

    if (!pool_name) {
      return NextResponse.json({ ok: false, error: "Pool name is required" }, { status: 400 });
    }
    if (!Number.isFinite(season_year) || season_year < 2000 || season_year > 2100) {
      return NextResponse.json({ ok: false, error: "Season year looks invalid" }, { status: 400 });
    }

    const { error: upErr } = await supabase
      .from("pools")
      .update({
        pool_name,
        season_year,
        entry_fee_cents,
        is_public,
        max_losses,
      })
      .eq("id", poolId);

    if (upErr) {
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}