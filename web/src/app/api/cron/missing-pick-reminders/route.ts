import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEST_EMAIL = "pjhudgin@gmail.com";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function isAuthorized(req: Request) {
  if (process.env.NODE_ENV !== "production") return true;

  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = req.headers.get("authorization") ?? "";

  if (auth === `Bearer ${secret}`) {
    return true;
  }

  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

type MissingEntry = {
  entryNo: number;
  screenName: string;
};

type Recipient = {
  user_id: string;
  email: string | null;
  entries: MissingEntry[];
};

function makeEmailHtml({
  poolName,
  weekNumber,
  entries,
  pickUrl,
  testMode,
}: {
  poolName: string;
  weekNumber: number;
  entries: MissingEntry[];
  pickUrl: string;
  testMode: boolean;
}) {
  const entryLines = entries
    .map(
      (entry) =>
        `<li><strong>${escapeHtml(entry.screenName)}</strong> — Entry #${entry.entryNo}</li>`
    )
    .join("");

  const testBanner = testMode
    ? `
      <div style="
        background:#fff3cd;
        border:1px solid #ffe69c;
        padding:12px;
        border-radius:8px;
        margin-bottom:20px;
        font-weight:bold;
      ">
        TEST EMAIL — No pool participants received this message.
      </div>
    `
    : "";

  return `
    <div style="
      font-family:Arial,sans-serif;
      max-width:600px;
      margin:0 auto;
      color:#111827;
    ">
      ${testBanner}

      <h2 style="margin-bottom:8px;">
        🏈 ${escapeHtml(poolName)}
      </h2>

      <p>
        Good morning! You still have ${
          entries.length === 1 ? "an entry" : "entries"
        } without a Week ${weekNumber} pick:
      </p>

      <ul style="line-height:1.7;">
        ${entryLines}
      </ul>

      <p>
        Make your pick before your selected game's kickoff.
      </p>

      <p style="margin:28px 0;">
        <a
          href="${pickUrl}"
          style="
            display:inline-block;
            background:#c83803;
            color:white;
            text-decoration:none;
            font-weight:bold;
            padding:12px 20px;
            border-radius:8px;
          "
        >
          Make My Pick
        </a>
      </p>

      <p style="font-size:13px;color:#6b7280;">
        This is an automated Sunday morning reminder from Hudge Survivor.
      </p>
    </div>
  `;
}

export async function GET(req: Request) {
  const startedAt = Date.now();

  if (!isAuthorized(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const url = new URL(req.url);

    const poolId = url.searchParams.get("poolId")?.trim() ?? "";
    const testMode = url.searchParams.get("test") === "1";

    // Dry run is the default.
    // Test mode overrides dry run, but sends only to TEST_EMAIL.
    const dryRun =
      !testMode && url.searchParams.get("dryRun") !== "0";

    if (!poolId) {
      return NextResponse.json(
        {
          ok: false,
          error: "poolId is required",
        },
        { status: 400 }
      );
    }

    const admin = getAdminSupabase();

    const [{ data: pool }, { data: poolState }] =
      await Promise.all([
        admin
          .from("pools")
          .select("name, pool_name")
          .eq("id", poolId)
          .maybeSingle(),

        admin
          .from("pool_state")
          .select(
            "season_year, week_type, week_number, picks_locked"
          )
          .eq("pool_id", poolId)
          .maybeSingle(),
      ]);

    if (!poolState) {
      return NextResponse.json(
        { ok: false, error: "Pool state not found" },
        { status: 404 }
      );
    }

    const poolName =
      String(pool?.name ?? "").trim() ||
      String(pool?.pool_name ?? "").trim() ||
      "Hudge Survivor Pool";

    const seasonYear = Number(poolState.season_year ?? 2026);
    const weekNumber = Number(poolState.week_number ?? 1);

    const rawWeekType = String(
      poolState.week_type ?? "REG"
    ).toUpperCase();

    const pickWeekType =
      rawWeekType === "POST" || rawWeekType === "PLAYOFFS"
        ? "POST"
        : "REG";

    if (poolState.picks_locked) {
      return NextResponse.json({
        ok: true,
        dry_run: dryRun,
        test_mode: testMode,
        skipped: true,
        reason: "Picks are already locked",
        pool: poolName,
        week: weekNumber,
        duration_ms: Date.now() - startedAt,
      });
    }

    const [
      { data: members, error: membersError },
      { data: picks, error: picksError },
    ] = await Promise.all([
      admin
        .from("pool_members")
        .select(
          "user_id, screen_name, entry_no, eliminated, is_eliminated"
        )
        .eq("pool_id", poolId),

      admin
        .from("picks")
        .select("user_id, entry_no, picked_team")
        .eq("pool_id", poolId)
        .eq("week_number", weekNumber)
        .eq("week_type", pickWeekType),
    ]);

    if (membersError) throw membersError;
    if (picksError) throw picksError;

    const activeMembers = (members ?? []).filter(
      (member) =>
        !member.eliminated && !member.is_eliminated
    );

    const pickedEntries = new Set(
      (picks ?? [])
        .filter((pick) => Boolean(pick.picked_team))
        .map(
          (pick) =>
            `${String(pick.user_id)}:${Number(
              pick.entry_no ?? 1
            )}`
        )
    );

    const missingByUser = new Map<
      string,
      MissingEntry[]
    >();

    for (const member of activeMembers) {
      const userId = String(member.user_id ?? "");
      if (!userId) continue;

      const entryNo = Number(member.entry_no ?? 1);
      const key = `${userId}:${entryNo}`;

      if (pickedEntries.has(key)) continue;

      const entries = missingByUser.get(userId) ?? [];

      entries.push({
        entryNo,
        screenName:
          String(member.screen_name ?? "").trim() ||
          `Entry ${entryNo}`,
      });

      missingByUser.set(userId, entries);
    }

    if (missingByUser.size === 0) {
      return NextResponse.json({
        ok: true,
        dry_run: dryRun,
        test_mode: testMode,
        pool: poolName,
        week: weekNumber,
        people_missing_picks: 0,
        entries_missing_picks: 0,
        recipients: [],
        duration_ms: Date.now() - startedAt,
      });
    }

    const authUsers = new Map<string, string>();
    let page = 1;
    const perPage = 1000;

    while (true) {
      const { data, error } =
        await admin.auth.admin.listUsers({
          page,
          perPage,
        });

      if (error) throw error;

      for (const user of data.users) {
        if (user.email) {
          authUsers.set(user.id, user.email);
        }
      }

      if (data.users.length < perPage) break;

      page++;
    }

    const recipients: Recipient[] =
      Array.from(missingByUser.entries())
        .map(([userId, entries]) => ({
          user_id: userId,
          email: authUsers.get(userId) ?? null,
          entries: entries.sort(
            (a, b) => a.entryNo - b.entryNo
          ),
        }))
        .filter(
          (recipient) => Boolean(recipient.email)
        );

    const entriesMissing = recipients.reduce(
      (total, recipient) =>
        total + recipient.entries.length,
      0
    );

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dry_run: true,
        test_mode: false,
        pool: poolName,
        week: weekNumber,
        people_missing_picks: recipients.length,
        entries_missing_picks: entriesMissing,
        recipients,
        duration_ms: Date.now() - startedAt,
      });
    }

    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      throw new Error("Missing RESEND_API_KEY");
    }

    const resend = new Resend(apiKey);

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(
        /\/$/,
        ""
      ) || "https://hudge-survivor.vercel.app";

    const pickUrl =
      `${siteUrl}/pool/${poolId}/pick`;

    // TEST MODE:
    // Send exactly ONE representative reminder
    // to the commissioner's test address.
    if (testMode) {
      const sampleRecipient = recipients[0];

      if (!sampleRecipient) {
        return NextResponse.json({
          ok: false,
          error: "No missing-pick recipient available for test",
        });
      }

      const { data, error } =
        await resend.emails.send({
          from:
            "Hudge Survivor <reminders@mail.hudgesurvivorpool.com>",
          to: [TEST_EMAIL],
          subject:
            `[TEST] ${poolName} — Don't forget your Week ${weekNumber} pick`,
          html: makeEmailHtml({
            poolName,
            weekNumber,
            entries: sampleRecipient.entries,
            pickUrl,
            testMode: true,
          }),
        });

      if (error) {
        throw new Error(error.message);
      }

      return NextResponse.json({
        ok: true,
        dry_run: false,
        test_mode: true,
        test_email: TEST_EMAIL,
        sample_entries: sampleRecipient.entries,
        real_people_who_would_receive: recipients.length,
        real_entries_missing: entriesMissing,
        resend_id: data?.id ?? null,
        duration_ms: Date.now() - startedAt,
      });
    }

    let sent = 0;
    let skippedDuplicates = 0;

    const failures: Array<{
      email: string;
      error: string;
    }> = [];

    for (const recipient of recipients) {
      const email = recipient.email;
      if (!email) continue;

      const {
        data: reservation,
        error: reservationError,
      } = await admin
        .from("pick_reminder_sends")
        .insert({
          pool_id: poolId,
          user_id: recipient.user_id,
          season_year: seasonYear,
          week_type: pickWeekType,
          week_number: weekNumber,
          reminder_type: "sunday_missing_pick",
          recipient_email: email,
        })
        .select("id")
        .single();

      if (reservationError) {
        if (reservationError.code === "23505") {
          skippedDuplicates++;
          continue;
        }

        throw reservationError;
      }

      const plural =
        recipient.entries.length === 1
          ? "pick"
          : "picks";

      const { error } =
        await resend.emails.send({
          from:
            "Hudge Survivor <reminders@mail.hudgesurvivorpool.com>",
          to: [email],
          subject:
            `${poolName} — Don't forget your Week ${weekNumber} ${plural}`,
          html: makeEmailHtml({
            poolName,
            weekNumber,
            entries: recipient.entries,
            pickUrl,
            testMode: false,
          }),
        });

      if (error) {
        if (reservation?.id) {
          await admin
            .from("pick_reminder_sends")
            .delete()
            .eq("id", reservation.id);
        }

        failures.push({
          email,
          error:
            typeof error.message === "string"
              ? error.message
              : "Unknown Resend error",
        });
      } else {
        sent++;
      }
    }

    return NextResponse.json({
      ok: failures.length === 0,
      dry_run: false,
      test_mode: false,
      pool: poolName,
      week: weekNumber,
      people_missing_picks: recipients.length,
      entries_missing_picks: entriesMissing,
      emails_sent: sent,
      skipped_duplicates: skippedDuplicates,
      failures,
      duration_ms: Date.now() - startedAt,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    return NextResponse.json(
      {
        ok: false,
        error: message,
        duration_ms: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}
