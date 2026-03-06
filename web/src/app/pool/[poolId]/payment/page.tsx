import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import QRClient from "./qr-client";

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

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <Link href={`/pool/${poolId}`}>← Back to Dashboard</Link>

      <h1 style={{ marginTop: 20 }}>Pay Entry Fee</h1>

      <div
        style={{
          marginTop: 14,
          padding: "12px 14px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.18)",
          background: "rgba(0,0,0,0.25)",
          fontWeight: 800,
        }}
      >
        💳 Entry fee is <strong>$20</strong>.
      </div>

      <p style={{ marginTop: 14, opacity: 0.85 }}>
        Please include your <strong>screen name</strong> in the Venmo note so the
        commissioner can mark you paid.
      </p>

      {!venmoLink ? (
        <div
          style={{
            marginTop: 18,
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.05)",
          }}
        >
          Payment instructions have not been configured yet.  
          Please contact the commissioner for payment details.
        </div>
      ) : (
        <>
          <a
            href={venmoLink}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-block",
              marginTop: 18,
              padding: "10px 14px",
              border: "1px solid white",
              borderRadius: 10,
              textDecoration: "none",
              fontWeight: 900,
            }}
          >
            Open Venmo →
          </a>

          <div style={{ marginTop: 30 }}>
            <QRClient value={venmoLink} />
          </div>
        </>
      )}

      <div style={{ marginTop: 30, opacity: 0.75, fontSize: 14 }}>
        Full pool rules will be available on the Rules page.
      </div>
    </div>
  );
}