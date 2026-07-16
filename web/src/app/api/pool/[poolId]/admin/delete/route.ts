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

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ poolId: string }> }
) {
  try {
    const supabase = await createClient();
    const adminSupabase = getAdminSupabase();
    const { poolId } = await params;

    const { data: userRes } = await supabase.auth.getUser();

    if (!userRes?.user) {
      return NextResponse.json(
        { error: "Not logged in" },
        { status: 401 }
      );
    }

    const { data: memberRows, error: memberError } = await supabase
      .from("pool_members")
      .select("is_commissioner, role")
      .eq("pool_id", poolId)
      .eq("user_id", userRes.user.id);

    if (memberError) {
      return NextResponse.json(
        { error: memberError.message },
        { status: 400 }
      );
    }

    const isCommissioner = (memberRows ?? []).some(
      (row) =>
        Boolean(row?.is_commissioner) ||
        String(row?.role ?? "").toLowerCase() === "commissioner" ||
        String(row?.role ?? "").toLowerCase() === "admin"
    );

    if (!isCommissioner) {
      return NextResponse.json(
        { error: "Only the commissioner can delete this pool" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const confirmationWord = String(body.confirmationWord ?? "")
      .trim()
      .toUpperCase();
    const confirmationName = String(body.confirmationName ?? "").trim();

    if (confirmationWord !== "DELETE") {
      return NextResponse.json(
        { error: 'Type DELETE to confirm.' },
        { status: 400 }
      );
    }

    const { data: pool, error: poolError } = await adminSupabase
      .from("pools")
      .select("id, name")
      .eq("id", poolId)
      .maybeSingle();

    if (poolError) {
      return NextResponse.json(
        { error: poolError.message },
        { status: 400 }
      );
    }

    if (!pool) {
      return NextResponse.json(
        { error: "Pool not found" },
        { status: 404 }
      );
    }

    const poolName = String(pool.name ?? "").trim();

    if (!poolName || confirmationName !== poolName) {
      return NextResponse.json(
        { error: "The pool name confirmation does not match." },
        { status: 400 }
      );
    }

    const { error: auditError } = await adminSupabase
      .from("audit_log")
      .delete()
      .eq("pool_id", poolId);

    if (auditError) {
      return NextResponse.json(
        { error: `Could not remove audit records: ${auditError.message}` },
        { status: 400 }
      );
    }

    const { error: lockError } = await adminSupabase
      .from("pool_week_locks")
      .delete()
      .eq("pool_id", poolId);

    if (lockError) {
      return NextResponse.json(
        { error: `Could not remove week locks: ${lockError.message}` },
        { status: 400 }
      );
    }

    const { error: deleteError } = await adminSupabase
      .from("pools")
      .delete()
      .eq("id", poolId);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      deletedPoolId: poolId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Pool deletion failed" },
      { status: 500 }
    );
  }
}