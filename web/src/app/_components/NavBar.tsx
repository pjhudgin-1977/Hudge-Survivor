"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type NavItem = {
  label: string;
  href: string;
  active: (pathname: string, base: string) => boolean;
};

export default function NavBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const parts = pathname.split("/").filter(Boolean);

  if (parts.length < 2 || parts[0] !== "pool") return null;

  const poolId = parts[1];
  const base = `/pool/${poolId}`;

  const items: NavItem[] = [
    {
      label: "Standings",
      href: base,
      active: (p, b) =>
        p === b || p === `${b}/standings` || p === `${b}/standings2`,
    },
    {
      label: "Pick",
      href: `${base}/pick`,
      active: (p, b) =>
        p === `${b}/pick` ||
        p.startsWith(`${b}/pick/`) ||
        p === `${b}/my-picks`,
    },
    {
      label: "Message Board",
      href: `${base}/board`,
      active: (p, b) => p === `${b}/board`,
    },
    {
      label: "Game Day",
      href: `${base}/gameday`,
      active: (p, b) =>
        p === `${b}/gameday` ||
        p === `${b}/sweat` ||
        p === `${b}/danger`,
    },
  ];

  const moreActive =
    pathname === `${base}/rules` ||
    pathname === `${base}/invite` ||
    pathname === `${base}/payment` ||
    pathname === `${base}/admin` ||
    pathname === `${base}/profile` ||
    pathname === "/profile";

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <nav
      style={{
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {items.map((item) => {
          const active = item.active(pathname, base);

          return (
            <Link
              key={item.label}
              href={item.href}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                textDecoration: "none",
                fontWeight: 800,
                fontSize: 14,
                border: active
                  ? "1px solid #f59e0b"
                  : "1px solid rgba(255,255,255,0.14)",
                background: active
                  ? "rgba(245,158,11,0.16)"
                  : "rgba(255,255,255,0.04)",
                color: active ? "#fde68a" : "rgba(255,255,255,0.92)",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <div ref={menuRef} style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            cursor: "pointer",
            userSelect: "none",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 38,
            height: 38,
            borderRadius: 999,
            border: moreActive
              ? "1px solid #f59e0b"
              : "1px solid rgba(255,255,255,0.14)",
            background: moreActive
              ? "rgba(245,158,11,0.16)"
              : "rgba(255,255,255,0.04)",
            color: moreActive ? "#fde68a" : "rgba(255,255,255,0.92)",
            fontSize: 22,
            fontWeight: 900,
          }}
          aria-label="More navigation"
          aria-expanded={open}
        >
          ⋯
        </button>

        {open ? (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 46,
              width: 190,
              borderRadius: 14,
              background: "#0f172a",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 14px 40px rgba(0,0,0,0.35)",
              overflow: "hidden",
              zIndex: 50,
            }}
          >
            <a
              href={`${base}/rules`}
              style={{
                display: "block",
                padding: "12px 14px",
                textDecoration: "none",
                color: "white",
                fontWeight: 700,
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              Rules
            </a>

            <a
              href={`${base}/invite`}
              style={{
                display: "block",
                padding: "12px 14px",
                textDecoration: "none",
                color: "white",
                fontWeight: 700,
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              Invite
            </a>

            <a
              href="/profile"
              style={{
                display: "block",
                padding: "12px 14px",
                textDecoration: "none",
                color: "white",
                fontWeight: 700,
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              Profile
            </a>

            <a
              href={`${base}/payment`}
              style={{
                display: "block",
                padding: "12px 14px",
                textDecoration: "none",
                color: "white",
                fontWeight: 700,
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              Payments
            </a>

            <a
              href={`${base}/admin`}
              style={{
                display: "block",
                padding: "12px 14px",
                textDecoration: "none",
                color: "#fbbf24",
                fontWeight: 800,
              }}
            >
              Admin
            </a>
          </div>
        ) : null}
      </div>
    </nav>
  );
}