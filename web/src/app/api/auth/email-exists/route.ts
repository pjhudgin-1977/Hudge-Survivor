import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email =
      typeof body?.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    if (!email) {
      return NextResponse.json(
        { ok: false, error: "Email is required." },
        { status: 400 }
      );
    }

    const admin = getAdminSupabase();

    const perPage = 1000;
    let page = 1;

    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) {
        throw error;
      }

      const exists = data.users.some(
        (user) => user.email?.trim().toLowerCase() === email
      );

      if (exists) {
        return NextResponse.json({
          ok: true,
          exists: true,
        });
      }

      if (data.users.length < perPage) {
        break;
      }

      page++;
    }

    return NextResponse.json({
      ok: true,
      exists: false,
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
