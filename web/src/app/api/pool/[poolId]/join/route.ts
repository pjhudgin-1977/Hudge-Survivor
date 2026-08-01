import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ poolId: string }> }
) {
  try {
    const supabase = await createClient();
    const { poolId } = await params;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not logged in." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const inviteCode = String(body?.invite_code || "")
      .trim()
      .toUpperCase();
    const fullName = String(body?.full_name || "").trim();
    const screenName = String(body?.screen_name || "").trim();

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

    if (!/^HUDGE-[A-Z0-9]{4}$/.test(inviteCode)) {
      return NextResponse.json(
        { error: "A valid HUDGE invite code is required." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc(
      "join_pool_with_invite",
      {
        p_code: inviteCode,
        p_expected_pool_id: poolId,
        p_full_name: fullName,
        p_screen_name: screenName,
      }
    );

    if (error) {
      const message = error.message || "Could not join pool.";

      const status =
        message.includes("maximum of 3 entries") ||
        message.includes("Invalid or expired") ||
        message.includes("does not match") ||
        message.includes("must be")
          ? 400
          : 500;

      return NextResponse.json({ error: message }, { status });
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (!result?.pool_id) {
      return NextResponse.json(
        { error: "Could not join pool." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      pool_id: result.pool_id,
      entry_no: result.entry_no,
      screen_name: result.screen_name,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Could not join pool.";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
