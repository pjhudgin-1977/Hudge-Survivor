import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function looksLikeHtml(s: string) {
  const t = (s || "").trim().toLowerCase();
  return t.startsWith("<!doctype html") || t.startsWith("<html");
}

function parseEntryNo(value: FormDataEntryValue | null) {
  const n = Number(value ?? 0);
  if (!Number.isInteger(n) || n < 1 || n > 3) return null;
  return n;
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr) {
      return NextResponse.json({ ok: false, error: authErr.message }, { status: 401 });
    }
    if (!auth?.user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const form = await req.formData();

    const pool_id = String(form.get("pool_id") ?? "");
    const picked_team = String(form.get("picked_team") ?? "");
    const week_number = Number(form.get("week_number") ?? 0);
    const phase = String(form.get("phase") ?? "regular");
    const week_type = String(form.get("week_type") ?? "REG");
    const entry_no = parseEntryNo(form.get("entry_no"));

    if (!pool_id || pool_id === "undefined") {
      return NextResponse.json({ ok: false, error: "Missing pool_id" }, { status: 400 });
    }
    if (!picked_team) {
      return NextResponse.json({ ok: false, error: "Please select a team" }, { status: 400 });
    }
    if (!week_number) {
      return NextResponse.json({ ok: false, error: "Missing week_number" }, { status: 400 });
    }
    if (!entry_no) {
      return NextResponse.json({ ok: false, error: "Missing or invalid entry_no" }, { status: 400 });
    }

    // Confirm this entry belongs to the current user in this pool
    const { data: memberRow, error: memberErr } = await supabase
      .from("pool_members")
      .select("pool_id, user_id, entry_no")
      .eq("pool_id", pool_id)
      .eq("user_id", auth.user.id)
      .eq("entry_no", entry_no)
      .maybeSingle();

    if (memberErr) {
      const msg = String(memberErr.message ?? "Unknown error");
      return NextResponse.json(
        {
          ok: false,
          error: looksLikeHtml(msg)
            ? "Supabase returned an HTML error page (gateway). Please retry."
            : msg,
        },
        { status: 500 }
      );
    }

    if (!memberRow) {
      return NextResponse.json(
        { ok: false, error: `Entry ${entry_no} was not found for this pool.` },
        { status: 403 }
      );
    }

    // Find existing pick for this specific entry
    const { data: existing, error: findErr } = await supabase
      .from("picks")
      .select("id")
      .eq("pool_id", pool_id)
      .eq("user_id", auth.user.id)
      .eq("entry_no", entry_no)
      .eq("week_number", week_number)
      .eq("phase", phase)
      .maybeSingle();

    if (findErr) {
      const msg = String(findErr.message ?? "Unknown error");
      return NextResponse.json(
        {
          ok: false,
          error: looksLikeHtml(msg)
            ? "Supabase returned an HTML error page (gateway). Please retry."
            : msg,
        },
        { status: 500 }
      );
    }

    const payload: any = {
      pool_id,
      user_id: auth.user.id,
      entry_no,
      week_number,
      phase,
      week_type,
      picked_team,
      submitted_at: new Date().toISOString(),
    };

    if (existing?.id) {
      const { error: updErr } = await supabase
        .from("picks")
        .update(payload)
        .eq("id", existing.id);

      if (updErr) {
        const msg = String(updErr.message ?? "Unknown error");
        return NextResponse.json(
          {
            ok: false,
            error: looksLikeHtml(msg)
              ? "Supabase returned an HTML error page (gateway). Please retry."
              : msg,
          },
          { status: 500 }
        );
      }
    } else {
      const { error: insErr } = await supabase.from("picks").insert(payload);

      if (insErr) {
        const msg = String(insErr.message ?? "Unknown error");
        return NextResponse.json(
          {
            ok: false,
            error: looksLikeHtml(msg)
              ? "Supabase returned an HTML error page (gateway). Please retry."
              : msg,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.redirect(
      new URL(`/pool/${pool_id}/pick?entry=${entry_no}`, req.url)
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unexpected server error" },
      { status: 500 }
    );
  }
}