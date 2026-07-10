import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ActionName = "update-spreads" | "autolock" | "grade";

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

function getCronPath(action: ActionName) {
  if (action === "update-spreads") {
    return "/api/cron/update-spreads";
  }

  if (action === "autolock") {
    return "/api/cron/autolock";
  }

  return "/api/cron/grade";
}

export async function POST(
  req: Request,
  context: {
    params: Promise<{
      poolId: string;
    }>;
  }
) {
  try {
    const { poolId } = await context.params;
    const supabase = await createClient();

    const { data: auth, error: authError } =
      await supabase.auth.getUser();

    if (authError || !auth?.user) {
      return NextResponse.json(
        {
          ok: false,
          error: "You must be logged in.",
        },
        { status: 401 }
      );
    }

    /*
     * A user can have multiple entries in the same pool.
     * Check specifically for any commissioner membership.
     */
    const adminSupabase = getAdminSupabase();

    const { data: commissionerMembership, error: membershipError } =
      await adminSupabase
        .from("pool_members")
        .select("role")
        .eq("pool_id", poolId)
        .eq("user_id", auth.user.id)
        .eq("role", "commissioner")
        .limit(1)
        .maybeSingle();

    if (membershipError) {
      throw membershipError;
    }

    if (!commissionerMembership) {
      return NextResponse.json(
        {
          ok: false,
          error: "Commissioner access required.",
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    const action = body?.action as ActionName | undefined;

    if (
      action !== "update-spreads" &&
      action !== "autolock" &&
      action !== "grade"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid commissioner action.",
        },
        { status: 400 }
      );
    }

    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing CRON_SECRET.",
        },
        { status: 500 }
      );
    }

    const requestUrl = new URL(req.url);
    const cronUrl = new URL(
      getCronPath(action),
      requestUrl.origin
    );

    const cronResponse = await fetch(cronUrl.toString(), {
      method: "GET",
      headers: {
        authorization: `Bearer ${cronSecret}`,
      },
      cache: "no-store",
    });

    const contentType =
      cronResponse.headers.get("content-type") ?? "";

    let result: unknown;

    if (contentType.includes("application/json")) {
      result = await cronResponse.json();
    } else {
      result = {
        ok: false,
        error: await cronResponse.text(),
      };
    }

    if (!cronResponse.ok) {
      return NextResponse.json(
        {
          ok: false,
          action,
          error:
            typeof result === "object" &&
            result !== null &&
            "error" in result
              ? String(result.error)
              : `${action} failed`,
          result,
        },
        { status: cronResponse.status }
      );
    }

    return NextResponse.json({
      ok: true,
      action,
      result,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}