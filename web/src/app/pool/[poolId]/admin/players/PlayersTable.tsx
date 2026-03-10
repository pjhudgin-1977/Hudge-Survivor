"use client";

import React from "react";

type SortKey =
  | "selected"
  | "screen_name"
  | "full_name"
  | "email"
  | "entry_no"
  | "role"
  | "entry_fee_paid"
  | "entry_fee_amount"
  | "status";

function getProfile(member: any) {
  const p = Array.isArray(member?.profiles) ? member.profiles[0] : member?.profiles;
  return {
    full_name: p?.full_name ?? "",
    email: p?.email ?? "",
  };
}

function roleLabel(member: any) {
  if (member?.is_commissioner) return "Commissioner";
  const role = String(member?.role || "").trim();
  return role ? role[0].toUpperCase() + role.slice(1) : "Member";
}

function hasRealAccount(row: any) {
  return !!String(row.email || "").trim();
}

function statusRank(row: any) {
  if (row?.is_eliminated) return 2;
  if (Number(row?.losses || 0) >= 1) return 1;
  return 0;
}

function compareValues(a: any, b: any, key: SortKey) {
  switch (key) {
    case "selected":
      return Number(!!a.selected) - Number(!!b.selected);

    case "screen_name":
      return String(a.screen_name || "").localeCompare(String(b.screen_name || ""));

    case "full_name":
      return String(a.full_name || "").localeCompare(String(b.full_name || ""));

    case "email":
      return String(a.email || "").localeCompare(String(b.email || ""));

    case "entry_no":
      return Number(a.entry_no || 1) - Number(b.entry_no || 1);

    case "role":
      return roleLabel(a).localeCompare(roleLabel(b));

    case "entry_fee_paid":
      return Number(!!a.entry_fee_paid) - Number(!!b.entry_fee_paid);

    case "entry_fee_amount":
      return Number(a.entry_fee_amount || 0) - Number(b.entry_fee_amount || 0);

    case "status":
      return statusRank(a) - statusRank(b);

    default:
      return 0;
  }
}

export default function PlayersTable({
  poolId,
  initialMembers,
}: {
  poolId: string;
  initialMembers: any[];
}) {
  const [rows, setRows] = React.useState(
    initialMembers.map((m) => {
      const profile = getProfile(m);
      return {
        ...m,
        full_name: profile.full_name,
        email: profile.email,
        selected: false,
        rowKey: `${m.user_id}-${m.entry_no ?? 1}`,
        entry_fee_amount:
          m.entry_fee_amount === null || m.entry_fee_amount === undefined
            ? ""
            : String(m.entry_fee_amount),
        saving: false,
        savedMsg: "",
        errMsg: "",
      };
    })
  );

  const [sortKey, setSortKey] = React.useState<SortKey>("entry_fee_paid");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");

  function setSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDir(nextKey === "entry_fee_paid" ? "desc" : "asc");
  }

  const sortedRows = React.useMemo(() => {
    const copy = [...rows];

    copy.sort((a, b) => {
      const primary = compareValues(a, b, sortKey);
      if (primary !== 0) return sortDir === "asc" ? primary : -primary;

      const secondary = String(a.screen_name || "").localeCompare(
        String(b.screen_name || "")
      );
      if (secondary !== 0) return secondary;

      return Number(a.entry_no || 1) - Number(b.entry_no || 1);
    });

    return copy;
  }, [rows, sortKey, sortDir]);

  const allVisibleSelected =
    sortedRows.length > 0 && sortedRows.every((r) => !!r.selected);

  async function saveRow(rowKey: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.rowKey === rowKey
          ? { ...r, saving: true, savedMsg: "", errMsg: "" }
          : r
      )
    );

    const row = rows.find((r) => r.rowKey === rowKey);
    if (!row) return;

    const amount =
      row.entry_fee_amount === "" ? null : Number(row.entry_fee_amount);

    try {
      const body: any = {
        user_id: row.user_id,
        entry_no: row.entry_no ?? 1,
        screen_name: row.screen_name ?? "",
        entry_fee_paid: !!row.entry_fee_paid,
        entry_fee_amount: amount,
      };

      if (hasRealAccount(row)) {
        body.full_name = row.full_name ?? "";
      }

      const res = await fetch(`/api/pool/${poolId}/admin/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Save failed");

      setRows((prev) =>
        prev.map((r) =>
          r.rowKey === rowKey
            ? { ...r, saving: false, savedMsg: "Saved!", errMsg: "" }
            : r
        )
      );
    } catch (e: any) {
      setRows((prev) =>
        prev.map((r) =>
          r.rowKey === rowKey
            ? { ...r, saving: false, savedMsg: "", errMsg: e.message }
            : r
        )
      );
    }
  }

  function exportSelectedEmails() {
    const emails = Array.from(
      new Set(
        rows
          .filter((r) => r.selected)
          .map((r) => String(r.email || "").trim())
          .filter(Boolean)
      )
    );

    if (emails.length === 0) {
      alert("No selected rows with real email addresses.");
      return;
    }

    const csv = ["email", ...emails].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "selected-player-emails.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function SortHeader({
    label,
    colKey,
  }: {
    label: string;
    colKey: SortKey;
  }) {
    const active = sortKey === colKey;
    const arrow = !active ? "" : sortDir === "asc" ? " ↑" : " ↓";

    return (
      <button
        type="button"
        onClick={() => setSort(colKey)}
        style={{
          background: "transparent",
          border: "none",
          color: active ? "#fde68a" : "white",
          fontWeight: 800,
          padding: 0,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {label}
        {arrow}
      </button>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 13, opacity: 0.8 }}>
          Default sort: <strong>Paid</strong>
        </div>

        <button
          type="button"
          onClick={exportSelectedEmails}
          style={{
            padding: "9px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.25)",
            background: "rgba(255,255,255,0.12)",
            color: "white",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Export Selected Emails
        </button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
        <thead>
          <tr style={{ textAlign: "left", opacity: 0.95 }}>
            <th
              style={{
                padding: 10,
                borderBottom: "1px solid rgba(255,255,255,0.15)",
                whiteSpace: "nowrap",
              }}
            >
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((row) => ({
                      ...row,
                      selected: e.target.checked,
                    }))
                  )
                }
              />
            </th>

            <th
              style={{
                padding: 10,
                borderBottom: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              <SortHeader label="Screen Name" colKey="screen_name" />
            </th>

            <th
              style={{
                padding: 10,
                borderBottom: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              <SortHeader label="Full Name" colKey="full_name" />
            </th>

            <th
              style={{
                padding: 10,
                borderBottom: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              <SortHeader label="Email" colKey="email" />
            </th>

            <th
              style={{
                padding: 10,
                borderBottom: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              <SortHeader label="Entry" colKey="entry_no" />
            </th>

            <th
              style={{
                padding: 10,
                borderBottom: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              <SortHeader label="Role" colKey="role" />
            </th>

            <th
              style={{
                padding: 10,
                borderBottom: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              <SortHeader label="Paid?" colKey="entry_fee_paid" />
            </th>

            <th
              style={{
                padding: 10,
                borderBottom: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              <SortHeader label="Amount" colKey="entry_fee_amount" />
            </th>

            <th
              style={{
                padding: 10,
                borderBottom: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              <SortHeader label="Status" colKey="status" />
            </th>

            <th
              style={{
                padding: 10,
                borderBottom: "1px solid rgba(255,255,255,0.15)",
                whiteSpace: "nowrap",
              }}
            >
              Action
            </th>
          </tr>
        </thead>

        <tbody>
          {sortedRows.map((r) => {
            const realAccount = hasRealAccount(r);

            return (
              <tr key={r.rowKey}>
                <td
                  style={{
                    padding: 10,
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    verticalAlign: "top",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!r.selected}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((x) =>
                          x.rowKey === r.rowKey
                            ? { ...x, selected: e.target.checked }
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
                    verticalAlign: "top",
                  }}
                >
                  <input
                    type="text"
                    value={r.screen_name || ""}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((x) =>
                          x.rowKey === r.rowKey
                            ? { ...x, screen_name: e.target.value, savedMsg: "", errMsg: "" }
                            : x
                        )
                      )
                    }
                    style={{
                      width: 180,
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
                    verticalAlign: "top",
                  }}
                >
                  <input
                    type="text"
                    value={r.full_name || ""}
                    disabled={!realAccount}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((x) =>
                          x.rowKey === r.rowKey
                            ? { ...x, full_name: e.target.value, savedMsg: "", errMsg: "" }
                            : x
                        )
                      )
                    }
                    style={{
                      width: 220,
                      padding: "6px 8px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.25)",
                      background: !realAccount
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(0,0,0,0.2)",
                      color: !realAccount ? "rgba(255,255,255,0.45)" : "white",
                      cursor: !realAccount ? "not-allowed" : "text",
                    }}
                  />
                  {!realAccount ? (
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.65 }}>
                      No account
                    </div>
                  ) : null}
                </td>

                <td
                  style={{
                    padding: 10,
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    verticalAlign: "top",
                    opacity: 0.9,
                  }}
                >
                  {realAccount ? (
                    r.email
                  ) : (
                    <span style={{ opacity: 0.6 }}>No account</span>
                  )}
                </td>

                <td
                  style={{
                    padding: 10,
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    verticalAlign: "top",
                  }}
                >
                  #{r.entry_no ?? 1}
                </td>

                <td
                  style={{
                    padding: 10,
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    verticalAlign: "top",
                  }}
                >
                  {roleLabel(r)}
                </td>

                <td
                  style={{
                    padding: 10,
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    verticalAlign: "top",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!r.entry_fee_paid}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((x) =>
                          x.rowKey === r.rowKey
                            ? { ...x, entry_fee_paid: e.target.checked, savedMsg: "", errMsg: "" }
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
                    verticalAlign: "top",
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
                          x.rowKey === r.rowKey
                            ? {
                                ...x,
                                entry_fee_amount: e.target.value,
                                savedMsg: "",
                                errMsg: "",
                              }
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
                    verticalAlign: "top",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.is_eliminated ? (
                    <span style={{ color: "#fca5a5", fontWeight: 800 }}>Eliminated</span>
                  ) : Number(r.losses || 0) >= 1 ? (
                    <span style={{ color: "#fbbf24", fontWeight: 800 }}>
                      Last Life ({Number(r.losses || 0)})
                    </span>
                  ) : (
                    <span style={{ color: "#86efac", fontWeight: 800 }}>Alive</span>
                  )}
                </td>

                <td
                  style={{
                    padding: 10,
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    verticalAlign: "top",
                    whiteSpace: "nowrap",
                  }}
                >
                  <button
                    onClick={() => saveRow(r.rowKey)}
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
            );
          })}
        </tbody>
      </table>

      <p style={{ marginTop: 12, opacity: 0.8, fontSize: 13 }}>
        Rows without a real account can still use Screen Name and payment fields. Export only includes selected real email addresses.
      </p>
    </div>
  );
}