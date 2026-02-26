"use client";

import React from "react";

export default function PlayersTable({
  poolId,
  initialMembers,
}: {
  poolId: string;
  initialMembers: any[];
}) {
  const [rows, setRows] = React.useState(
    initialMembers.map((m) => ({
      ...m,
      entry_fee_amount:
        m.entry_fee_amount === null || m.entry_fee_amount === undefined
          ? ""
          : String(m.entry_fee_amount),
      saving: false,
      savedMsg: "",
      errMsg: "",
    }))
  );

  async function saveRow(user_id: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.user_id === user_id
          ? { ...r, saving: true, savedMsg: "", errMsg: "" }
          : r
      )
    );

    const row = rows.find((r) => r.user_id === user_id);
    if (!row) return;

    const amount =
      row.entry_fee_amount === "" ? null : Number(row.entry_fee_amount);

    try {
      const res = await fetch(`/api/pool/${poolId}/admin/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id,
          entry_fee_paid: !!row.entry_fee_paid,
          entry_fee_amount: amount,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Save failed");

      setRows((prev) =>
        prev.map((r) =>
          r.user_id === user_id
            ? { ...r, saving: false, savedMsg: "Saved!", errMsg: "" }
            : r
        )
      );
    } catch (e: any) {
      setRows((prev) =>
        prev.map((r) =>
          r.user_id === user_id
            ? { ...r, saving: false, savedMsg: "", errMsg: e.message }
            : r
        )
      );
    }
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
        <thead>
          <tr style={{ textAlign: "left", opacity: 0.9 }}>
            <th
              style={{
                padding: 10,
                borderBottom: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              Player
            </th>
            <th
              style={{
                padding: 10,
                borderBottom: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              Paid?
            </th>
            <th
              style={{
                padding: 10,
                borderBottom: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              Amount
            </th>
            <th
              style={{
                padding: 10,
                borderBottom: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              Action
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => (
            <tr key={r.user_id}>
              <td
                style={{
                  padding: 10,
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <strong>{r.screen_name}</strong>
              </td>

              <td
                style={{
                  padding: 10,
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <input
                  type="checkbox"
                  checked={!!r.entry_fee_paid}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((x) =>
                        x.user_id === r.user_id
                          ? { ...x, entry_fee_paid: e.target.checked }
                          : x
                      )
                    )
                  }
                />
              </td>

              <td
                style={{
                  padding: 10,
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={r.entry_fee_amount}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((x) =>
                        x.user_id === r.user_id
                          ? { ...x, entry_fee_amount: e.target.value }
                          : x
                      )
                    )
                  }
                  style={{
                    width: 120,
                    padding: "6px 8px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.25)",
                    background: "rgba(0,0,0,0.2)",
                    color: "white",
                  }}
                />
              </td>

              <td
                style={{
                  padding: 10,
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <button
                  onClick={() => saveRow(r.user_id)}
                  disabled={r.saving}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.25)",
                    background: r.saving
                      ? "rgba(255,255,255,0.12)"
                      : "rgba(255,255,255,0.18)",
                    color: "white",
                    fontWeight: 800,
                    cursor: r.saving ? "not-allowed" : "pointer",
                  }}
                >
                  {r.saving ? "Saving..." : "Save"}
                </button>

                {r.savedMsg ? (
                  <span style={{ marginLeft: 10, color: "#9f9", fontWeight: 700 }}>
                    {r.savedMsg}
                  </span>
                ) : null}
                {r.errMsg ? (
                  <span style={{ marginLeft: 10, color: "#f99", fontWeight: 700 }}>
                    {r.errMsg}
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ marginTop: 12, opacity: 0.8, fontSize: 13 }}>
        Tip: mark yourself as Paid and refresh any pool page — the header badge will update.
      </p>
    </div>
  );
}