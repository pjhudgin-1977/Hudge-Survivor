import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ poolId: string }> }
) {
  try {
    const supabase = await createClient();
    const adminSupabase = getAdminSupabase();
    const { poolId } = await params;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { data: membership, error: membershipError } =
      await adminSupabase
        .from("pool_members")
        .select("user_id")
        .eq("pool_id", poolId)
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

    if (membershipError) {
      return NextResponse.json(
        { error: membershipError.message },
        { status: 400 }
      );
    }

    if (!membership) {
      return NextResponse.json(
        { error: "Not authorized for this pool" },
        { status: 403 }
      );
    }

    const { data: members, error: membersError } = await adminSupabase
      .from("pool_members")
      .select("user_id")
      .eq("pool_id", poolId);

    if (membersError) {
      return NextResponse.json(
        { error: membersError.message },
        { status: 400 }
      );
    }

    const userIds = Array.from(
      new Set(
        (members ?? [])
          .map((member) => String(member.user_id ?? "").trim())
          .filter(Boolean)
      )
    );

    if (userIds.length === 0) {
      return NextResponse.json({ profiles: [] });
    }

    const { data: profiles, error: profilesError } =
      await adminSupabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

    if (profilesError) {
      return NextResponse.json(
        { error: profilesError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      profiles: (profiles ?? []).map((profile) => ({
        user_id: profile.user_id,
        full_name:
          String(profile.full_name ?? "").trim() || null,
      })),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Server error",
      },
      { status: 500 }
    );
  }
}
