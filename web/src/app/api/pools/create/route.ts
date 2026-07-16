import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_COMMISSIONER_EMAIL = "pjhudgin@gmail.com";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createAdminClient(url, serviceRoleKey, {
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

    const { data: userResult } = await supabase.auth.getUser();
    const user = userResult?.user;

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in." },
        { status: 401 }
      );
    }

    const userEmail = String(user.email ?? "").trim().toLowerCase();

    if (userEmail !== ALLOWED_COMMISSIONER_EMAIL) {
      return NextResponse.json(
        { error: "You do not have permission to create pools." },
        { status: 403 }
      );
    }

    const body = await req.json();

    const name = String(body.name ?? "").trim();
    const screenName = String(body.screenName ?? "").trim();
    const seasonYear = Number(body.seasonYear);

    if (name.length < 3 || name.length > 60) {
      return NextResponse.json(
        { error: "Pool name must be between 3 and 60 characters." },
        { status: 400 }
      );
    }

    if (screenName.length < 2 || screenName.length > 30) {
      return NextResponse.json(
        { error: "Screen name must be between 2 and 30 characters." },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(seasonYear) ||
      seasonYear < 2026 ||
      seasonYear > 2035
    ) {
      return NextResponse.json(
        { error: "Season year must be between 2026 and 2035." },
        { status: 400 }
      );
    }

    const { data: pool, error: poolError } = await adminSupabase
      .from("pools")
      .insert([
        {
          name,
          pool_name: name,
          season_year: seasonYear,
          commissioner_user_id: user.id,
        },
      ])
      .select("id")
      .single();

    if (poolError) {
      return NextResponse.json(
        { error: poolError.message },
        { status: 500 }
      );
    }

    const { error: memberError } = await adminSupabase
      .from("pool_members")
      .insert([
        {
          pool_id: pool.id,
          user_id: user.id,
          entry_no: 1,
          screen_name: screenName,
          losses: 0,
          is_eliminated: false,
          is_commissioner: true,
          role: "commissioner",
        },
      ]);

    if (memberError) {
      await adminSupabase.from("pools").delete().eq("id", pool.id);

      return NextResponse.json(
        { error: memberError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      poolId: pool.id,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Pool creation failed." },
      { status: 500 }
    );
  }
}