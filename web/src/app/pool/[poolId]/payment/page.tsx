import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import QRClient from "./qr-client";
import PaymentActions from "./PaymentActions";

type MemberRow = {
  entry_no: number | null;
  screen_name: string | null;
  entry_fee_paid: boolean | null;
  entry_fee_amount: number | null;
};

function formatDollars(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login");

  const { poolId } = await params;
  const venmoLink = process.env.NEXT_PUBLIC_VENMO_LINK || "";

  const [{ data: pool }, { data: memberRows, error: memberError }] =
    await Promise.all([
      supabase
        .from("pools")
        .select("name, pool_name, entry_fee_cents")
        .eq("id", poolId)
        .maybeSingle(),
      supabase
        .from("pool_members")
        .select(
          "entry_no, screen_name, entry_fee_paid, entry_fee_amount"
        )
        .eq("pool_id", poolId)
        .eq("user_id", auth.user.id)
        .order("entry_no", { ascending: true }),
    ]);

  const poolName =
    String(pool?.name ?? "").trim() ||
    String(pool?.pool_name ?? "").trim() ||
    "Survivor Pool";

  const defaultAmount = Number(pool?.entry_fee_cents ?? 0) / 100;
  const entries = (memberRows ?? []) as MemberRow[];

  return (
    <main
      style={{
        width: "100%",
        maxWidth: 850,
        margin: "0 auto",
        padding: "32px 18px 44px",
        boxSizing: "border-box",
      }}
    >
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 14,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 950 }}>
            Payment
          </h1>

          <p style={{ margin: "7px 0 0", opacity: 0.72 }}>
            Pay your entry fee through Venmo.
          </p>
        </div>

        <Link
          href={`/pool/${poolId}`}
          style={{
            display: "inline-block",
            padding: "9px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.22)",
            background: "rgba(255,255,255,0.08)",
            color: "white",
            fontWeight: 850,
            textDecoration: "none",
          }}
        >
          Back to Dashboard
        </Link>
      </header>

      {memberError ? (
        <div
          style={{
            marginTop: 20,
            padding: 14,
            borderRadius: 12,
            border: "1px solid rgba(248,113,113,0.4)",
            background: "rgba(127,29,29,0.18)",
            color: "#fecaca",
          }}
        >
          Could not load your payment information: {memberError.message}
        </div>
      ) : null}

      <section
        style={{
          marginTop: 22,
          display: "grid",
          gap: 14,
        }}
      >
        {entries.length === 0 ? (
          <div
            style={{
              padding: 18,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.16)",
              background: "rgba(255,255,255,0.04)",
            }}
          >
            No entries were found for your account in this pool.
          </div>
        ) : (
          entries.map((entry) => {
            const entryNo = Number(entry.entry_no ?? 1);
            const rawScreenName =
              String(entry.screen_name ?? "").trim() || "Player";
            const screenName = rawScreenName.replace(
              /\s*\(Entry\s+\d+\)$/i,
              ""
            );

            const savedAmount = Number(entry.entry_fee_amount);
            const amount =
              Number.isFinite(savedAmount) && savedAmount > 0
                ? savedAmount
                : defaultAmount;

            const note = `${screenName} — Entry ${entryNo} — ${poolName}`;

            return (
              <article
                key={entryNo}
                style={{
                  padding: 18,
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.16)",
                  background: "rgba(10,12,18,0.6)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 900,
                        opacity: 0.66,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      Entry {entryNo}
                    </div>

                    <div
                      style={{
                        marginTop: 5,
                        fontSize: 25,
                        fontWeight: 950,
                      }}
                    >
                      {formatDollars(amount)} entry fee
                    </div>

                    <div style={{ marginTop: 4, opacity: 0.74 }}>
                      Screen name: <strong>{screenName}</strong>
                    </div>
                  </div>

                  <span
                    style={{
                      padding: "7px 11px",
                      borderRadius: 999,
                      border: entry.entry_fee_paid
                        ? "1px solid rgba(134,239,172,0.45)"
                        : "1px solid rgba(251,191,36,0.45)",
                      background: entry.entry_fee_paid
                        ? "rgba(22,101,52,0.28)"
                        : "rgba(120,53,15,0.28)",
                      color: entry.entry_fee_paid
                        ? "#bbf7d0"
                        : "#fde68a",
                      fontWeight: 900,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {entry.entry_fee_paid ? "✓ Paid" : "Payment due"}
                  </span>
                </div>

                {entry.entry_fee_paid ? (
                  <div style={{ marginTop: 14, opacity: 0.74 }}>
                    The commissioner has marked this entry as paid.
                  </div>
                ) : (
                  <>
                    <div style={{ marginTop: 16, fontWeight: 850 }}>
                      Include this note with your payment:
                    </div>

                    <PaymentActions
                      venmoLink={venmoLink}
                      note={note}
                    />
                  </>
                )}
              </article>
            );
          })
        )}
      </section>

      {!venmoLink ? (
        <div
          style={{
            marginTop: 20,
            padding: 14,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.05)",
          }}
        >
          Payment instructions have not been configured yet. Please
          contact the commissioner for payment details.
        </div>
      ) : entries.some((entry) => !entry.entry_fee_paid) ? (
        <section
          style={{
            marginTop: 22,
            width: "fit-content",
            maxWidth: "100%",
            padding: 18,
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.16)",
            background: "rgba(255,255,255,0.04)",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>
            Scan to pay with Venmo
          </h2>

          <div
            style={{
              marginTop: 14,
              padding: 10,
              width: "fit-content",
              maxWidth: "100%",
              background: "white",
              borderRadius: 10,
            }}
          >
            <QRClient value={venmoLink} />
          </div>
        </section>
      ) : null}
    </main>
  );
}
