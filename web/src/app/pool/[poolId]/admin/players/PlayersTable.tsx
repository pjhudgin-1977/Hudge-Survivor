"use client";

import React from "react";
import { MoreVertical } from "lucide-react";
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
        lastSavedEntryFeeAmount:
          m.entry_fee_amount === null || m.entry_fee_amount === undefined
            ? ""
            : String(m.entry_fee_amount),
        saving: false,
        removing: false,
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

  async function removeRow(rowKey: string) {
    const row = rows.find((r) => r.rowKey === rowKey);
    if (!row) return;

    const isCommissioner =
      Boolean(row.is_commissioner) ||
      String(row.role ?? "").toLowerCase() === "commissioner";

    if (isCommissioner) {
      alert("The commissioner entry cannot be removed.");
      return;
    }

    const confirmed = window.confirm(
      `Remove ${row.screen_name || "this player"} — Entry #${row.entry_no ?? 1}?\n\nThis will delete this entry's picks and used-team history. The user's login account will remain active.`
    );

    if (!confirmed) return;

    setRows((prev) =>
      prev.map((r) =>
        r.rowKey === rowKey
          ? { ...r, removing: true, savedMsg: "", errMsg: "" }
          : r
      )
    );

    try {
      const res = await fetch(`/api/pool/${poolId}/admin/players`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: row.user_id,
          entry_no: row.entry_no ?? 1,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Remove failed");
      }

      setRows((prev) => prev.filter((r) => r.rowKey !== rowKey));
    } catch (e: any) {
      setRows((prev) =>
        prev.map((r) =>
          r.rowKey === rowKey
            ? {
                ...r,
                removing: false,
                savedMsg: "",
                errMsg: e?.message || "Remove failed",
              }
            : r
        )
      );
    }
  }

  async function removeMember(rowKey: string) {
    const row = rows.find((r) => r.rowKey === rowKey);
    if (!row) return;

    const isCommissioner =
      Boolean(row.is_commissioner) ||
      String(row.role ?? "").toLowerCase() === "commissioner";

    if (isCommissioner) {
      alert("The commissioner cannot be removed from the pool.");
      return;
    }

    const memberEntries = rows.filter((r) => r.user_id === row.user_id);
    const memberName =
      String(row.full_name || "").trim() ||
      String(row.screen_name || "").trim() ||
      "this member";

    const confirmed = window.confirm(
      `Remove ${memberName} from this pool?\n\nThis will delete all ${memberEntries.length} of their pool entries, picks, and used-team history. Their login account will remain active.`
    );

    if (!confirmed) return;

    setRows((prev) =>
      prev.map((r) =>
        r.user_id === row.user_id
          ? { ...r, removing: true, savedMsg: "", errMsg: "" }
          : r
      )
    );

    try {
      const res = await fetch(`/api/pool/${poolId}/admin/players`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: row.user_id,
          remove_member: true,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Remove member failed");
      }

      setRows((prev) => prev.filter((r) => r.user_id !== row.user_id));
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Remove member failed";

      setRows((prev) =>
        prev.map((r) =>
          r.user_id === row.user_id
            ? {
                ...r,
                removing: false,
                savedMsg: "",
                errMsg: r.rowKey === rowKey ? message : "",
              }
            : r
        )
      );
    }
  }

  async function savePaidStatus(rowKey: string, nextPaid: boolean) {
    const row = rows.find((r) => r.rowKey === rowKey);
    if (!row || row.saving || row.removing) return;

    const previousPaid = !!row.entry_fee_paid;

    setRows((prev) =>
      prev.map((r) =>
        r.rowKey === rowKey
          ? {
              ...r,
              entry_fee_paid: nextPaid,
              saving: true,
              savedMsg: "",
              errMsg: "",
            }
          : r
      )
    );

    try {
      const res = await fetch(`/api/pool/${poolId}/admin/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: row.user_id,
          entry_no: row.entry_no ?? 1,
          entry_fee_paid: nextPaid,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Paid status update failed");
      }

      setRows((prev) =>
        prev.map((r) =>
          r.rowKey === rowKey
            ? {
                ...r,
                entry_fee_paid: nextPaid,
                saving: false,
                savedMsg: nextPaid ? "Marked paid" : "Marked unpaid",
                errMsg: "",
              }
            : r
        )
      );
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Paid status update failed";

      setRows((prev) =>
        prev.map((r) =>
          r.rowKey === rowKey
            ? {
                ...r,
                entry_fee_paid: previousPaid,
                saving: false,
                savedMsg: "",
                errMsg: message,
              }
            : r
        )
      );
    }
  }


  async function saveAmount(rowKey: string, rawValue: string) {
    const row = rows.find((r) => r.rowKey === rowKey);
    if (!row || row.saving || row.removing) return;

    const trimmedValue = rawValue.trim();
    const previousValue = String(row.lastSavedEntryFeeAmount ?? "");
    const amount = trimmedValue === "" ? null : Number(trimmedValue);

    if (
      amount !== null &&
      (!Number.isFinite(amount) || amount < 0)
    ) {
      setRows((prev) =>
        prev.map((r) =>
          r.rowKey === rowKey
            ? {
                ...r,
                savedMsg: "",
                errMsg: "Enter a valid payment amount.",
              }
            : r
        )
      );
      return;
    }

    const normalizedValue =
      amount === null ? "" : String(amount);

    if (normalizedValue === previousValue) return;

    setRows((prev) =>
      prev.map((r) =>
        r.rowKey === rowKey
          ? {
              ...r,
              entry_fee_amount: normalizedValue,
              saving: true,
              savedMsg: "",
              errMsg: "",
            }
          : r
      )
    );

    try {
      const res = await fetch(`/api/pool/${poolId}/admin/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: row.user_id,
          entry_no: row.entry_no ?? 1,
          entry_fee_amount: amount,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Amount update failed");
      }

      setRows((prev) =>
        prev.map((r) =>
          r.rowKey === rowKey
            ? {
                ...r,
                entry_fee_amount: normalizedValue,
                lastSavedEntryFeeAmount: normalizedValue,
                saving: false,
                savedMsg: "Amount saved",
                errMsg: "",
              }
            : r
        )
      );
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Amount update failed";

      setRows((prev) =>
        prev.map((r) =>
          r.rowKey === rowKey
            ? {
                ...r,
                entry_fee_amount: previousValue,
                saving: false,
                savedMsg: "",
                errMsg: message,
              }
            : r
        )
      );
    }
  }

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
            ? {
                ...r,
                lastSavedEntryFeeAmount: String(r.entry_fee_amount ?? ""),
                saving: false,
                savedMsg: "Saved!",
                errMsg: "",
              }
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
                    disabled={r.saving || r.removing}
                    onChange={(e) =>
                      savePaidStatus(r.rowKey, e.target.checked)
                    }
                    title="Payment status saves automatically"
                    style={{
                      cursor:
                        r.saving || r.removing ? "not-allowed" : "pointer",
                      opacity: r.saving || r.removing ? 0.6 : 1,
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
                    onBlur={(e) =>
                      void saveAmount(r.rowKey, e.currentTarget.value)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.currentTarget.blur();
                      }
                    }}
                    disabled={r.saving || r.removing}
                    title="Amount saves automatically"
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
                  {r.is_commissioner ||
                  String(r.role ?? "").toLowerCase() === "commissioner" ? (
                    <button
                      type="button"
                      onClick={() => saveRow(r.rowKey)}
                      disabled={r.saving || r.removing}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.25)",
                        background: "rgba(255,255,255,0.18)",
                        color: "white",
                        fontWeight: 800,
                        cursor:
                          r.saving || r.removing ? "not-allowed" : "pointer",
                        opacity: r.saving || r.removing ? 0.6 : 1,
                      }}
                    >
                      {r.saving ? "Saving..." : "Save"}
                    </button>
                  ) : (
                    <details style={{ position: "relative", display: "inline-block" }}>
                      <summary
                        style={{
                          listStyle: "none",
                          padding: "8px 12px",
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.25)",
                          background: "rgba(255,255,255,0.18)",
                          color: "white",
                          fontWeight: 800,
                          cursor:
                            r.saving || r.removing ? "not-allowed" : "pointer",
                          opacity: r.saving || r.removing ? 0.6 : 1,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.saving
                          ? "Saving..."
                          : r.removing
                            ? "Removing..."
                            : "Actions ▾"}
                      </summary>

                      <div
                        style={{
                          position: "absolute",
                          top: "calc(100% + 6px)",
                          right: 0,
                          zIndex: 20,
                          minWidth: 170,
                          padding: 6,
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.2)",
                          background: "#111827",
                          boxShadow: "0 10px 24px rgba(0,0,0,0.4)",
                          display: "grid",
                          gap: 5,
                        }}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.currentTarget
                              .closest("details")
                              ?.removeAttribute("open");
                            void saveRow(r.rowKey);
                          }}
                          disabled={r.saving || r.removing}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: "none",
                            background: "rgba(255,255,255,0.12)",
                            color: "white",
                            fontWeight: 800,
                            textAlign: "left",
                            cursor:
                              r.saving || r.removing
                                ? "not-allowed"
                                : "pointer",
                          }}
                        >
                          Save Changes
                        </button>

                        <button
                          type="button"
                          onClick={() => removeRow(r.rowKey)}
                          disabled={r.removing || r.saving}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: "none",
                            background: "rgba(127,29,29,0.4)",
                            color: "#fecaca",
                            fontWeight: 800,
                            textAlign: "left",
                            cursor:
                              r.removing || r.saving
                                ? "not-allowed"
                                : "pointer",
                          }}
                        >
                          Remove Entry
                        </button>

                        <button
                          type="button"
                          onClick={() => removeMember(r.rowKey)}
                          disabled={r.removing || r.saving}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: "none",
                            background: "rgba(69,10,10,0.8)",
                            color: "#fee2e2",
                            fontWeight: 900,
                            textAlign: "left",
                            cursor:
                              r.removing || r.saving
                                ? "not-allowed"
                                : "pointer",
                          }}
                        >
                          Remove Member
                        </button>
                      </div>
                    </details>
                  )}

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

    </div>
  );
}
