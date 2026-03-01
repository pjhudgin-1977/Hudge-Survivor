import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Body = {
  poolId: string;
  userId: string;
  action: "reset_losses" | "set_eliminated";
  value?: boolean;
};

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    // Must be logged in
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr) {
      return NextResponse.json({ ok: false, error: authErr.message }, { status: 401 });
    }
    if (!auth?.user) {
      return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });
    }

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const poolId = String(body.poolId ?? "").trim();
    const userId = String(body.userId ?? "").trim();
    const action = body.action;

    if (!poolId || !userId || !action) {
      return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
    }

    // Commissioner-only gate
    const { data: gate, error: gateErr } = await supabase
      .from("pool_members")
      .select("is_commissioner")
      .eq("pool_id", poolId)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (gateErr) {
      return NextResponse.json({ ok: false, error: gateErr.message }, { status: 403 });
    }
    if (!gate?.is_commissioner) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    if (action === "reset_losses") {
      const { error: upErr } = await supabase
        .from("pool_members")
        .update({
          losses: 0,
          eliminated: false,
          is_eliminated: false,
        })
        .eq("pool_id", poolId)
        .eq("user_id", userId);

      if (upErr) {
        return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 });
      }

      return NextResponse.json({ ok: true });
    }

    if (action === "set_eliminated") {
      const value = Boolean(body.value);

      const { error: upErr } = await supabase
        .from("pool_members")
        .update({
          eliminated: value,
          is_eliminated: value,
        })
        .eq("pool_id", poolId)
        .eq("user_id", userId);

      if (upErr) {
        return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 });
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    // IMPORTANT: Always JSON, even on unexpected crashes
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}