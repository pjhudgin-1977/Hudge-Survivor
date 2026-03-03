"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  // Render nothing if not commissioner
  isCommissioner: boolean;

  // So we can label the action nicely
  entryFeePaid: boolean;

  // Existing actions
  onTogglePaid: () => Promise<void> | void;
  onResetAutopicks?: () => Promise<void> | void;

  // NEW action
  onForcePick?: () => Promise<void> | void;

  // Optional: disable while your row mutation is in-flight
  disabled?: boolean;
};

export default function CommissionerActionMenu({
  isCommissioner,
  entryFeePaid,
  onTogglePaid,
  onResetAutopicks,
  onForcePick,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // click-outside to close
  useEffect(() => {
    if (!open) return;

    function onDocMouseDown(e: MouseEvent) {
      const el = wrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    }

    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!isCommissioner) return null;

  async function run(action?: () => Promise<void> | void) {
    if (disabled) return;
    if (!action) return;
    try {
      await action();
    } finally {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        aria-label="Commissioner actions"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        style={{
          width: 34,
          height: 30,
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.22)",
          background: "rgba(0,0,0,0.25)",
          color: "white",
          cursor: disabled ? "not-allowed" : "pointer",
          fontSize: 16,
          lineHeight: "28px",
          fontWeight: 900,
        }}
      >
        ⚙️
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Commissioner action menu"
          style={{
            position: "absolute",
            right: 0,
            top: 36,
            minWidth: 210,
            background: "rgba(15,15,15,0.98)",
            border: "1px solid rgba(255,255,255,0.16)",
            borderRadius: 14,
            boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
            padding: 6,
            zIndex: 50,
          }}
        >
          <MenuItem
            label={entryFeePaid ? "Mark Unpaid" : "Mark Paid"}
            sublabel="Toggle entry fee status"
            onClick={() => run(onTogglePaid)}
            disabled={disabled}
          />

          <MenuItem
            label="Reset Autopicks Used"
            sublabel="Set autopicks_used back to 0"
            onClick={() => run(onResetAutopicks)}
            disabled={disabled || !onResetAutopicks}
          />

          <div
            style={{
              height: 1,
              background: "rgba(255,255,255,0.10)",
              margin: "6px 6px",
            }}
          />

          <MenuItem
            label="Force Pick"
            sublabel="Commissioner override pick"
            onClick={() => run(onForcePick)}
            disabled={disabled || !onForcePick}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  sublabel,
  onClick,
  disabled,
}: {
  label: string;
  sublabel?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={!!disabled}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "10px 10px",
        borderRadius: 12,
        border: "none",
        background: disabled ? "rgba(255,255,255,0.06)" : "transparent",
        color: disabled ? "rgba(255,255,255,0.55)" : "white",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 13, letterSpacing: 0.2 }}>
        {label}
      </div>
      {sublabel ? (
        <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>
          {sublabel}
        </div>
      ) : null}
    </button>
  );
}