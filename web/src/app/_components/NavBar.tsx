"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type NavItem = {
  label: string;
  href: string;
  active: (pathname: string, base: string) => boolean;
};

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const parts = pathname.split("/").filter(Boolean);

  if (parts.length < 2 || parts[0] !== "pool") return null;

  const poolId = parts[1];
  const base = `/pool/${poolId}`;

  async function handleLogout() {
    const { createClient } = await import("@/lib/supabaseClient");
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const items: NavItem[] = [
    {
      label: "🏆 Standings",
      href: base,
      active: (p, b) =>
        p === b || p === `${b}/standings` || p === `${b}/standings2`,
    },
    {
      label: "✏️ Pick",
      href: `${base}/pick`,
      active: (p, b) =>
        p === `${b}/pick` ||
        p.startsWith(`${b}/pick/`) ||
        p === `${b}/my-picks`,
    },
    {
      label: "💬 Message Board",
      href: `${base}/board`,
      active: (p, b) => p === `${b}/board`,
    },
    {
      label: "🏈 Game Day",
      href: `${base}/gameday`,
      active: (p, b) =>
        p === `${b}/gameday` ||
        p === `${b}/sweat` ||
        p === `${b}/danger`,
    },
  ];

  const moreItems = [
    { label: "Rules", href: `${base}/rules` },
    { label: "Invite", href: `${base}/invite` },
    { label: "Profile", href: "/profile" },
    { label: "Payments", href: `${base}/payment` },
    { label: "Admin", href: `${base}/admin` },
  ];

  const moreActive = moreItems.some((item) => pathname.startsWith(item.href));

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
        position: "sticky",
        top: 0,
        zIndex: 40,
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 0",
        marginBottom: 16,
        background: "#020617",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
          flex: 1,
          minWidth: 0,
        }}
      >
        {items.map((item) => {
          const active = item.active(pathname, base);

          return (
            <Link
              key={item.label}
              href={item.href}
              style={{
                padding: "7px 12px",
                borderRadius: 10,
                textDecoration: "none",
                fontWeight: 800,
                fontSize: 13,
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
            padding: "0 14px",
            height: 38,
            borderRadius: 999,
            border: moreActive
              ? "1px solid #f59e0b"
              : "1px solid rgba(255,255,255,0.14)",
            background: moreActive
              ? "rgba(245,158,11,0.16)"
              : "rgba(255,255,255,0.04)",
            color: moreActive ? "#fde68a" : "rgba(255,255,255,0.92)",
            fontSize: 14,
            fontWeight: 900,
          }}
          aria-label="More navigation"
          aria-expanded={open}
        >
          More
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
            {moreItems.map((item, index) => {
              const isAdmin = item.label === "Admin";

              return (
                <a
                  key={item.label}
                  href={item.href}
                  style={{
                    display: "block",
                    padding: "12px 14px",
                    textDecoration: "none",
                    color: isAdmin ? "#fbbf24" : "white",
                    fontWeight: isAdmin ? 800 : 700,
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {item.label}
                </a>
              );
            })}

            <button
              type="button"
              onClick={handleLogout}
              style={{
                display: "block",
                width: "100%",
                padding: "12px 14px",
                textDecoration: "none",
                color: "#fca5a5",
                fontWeight: 800,
                border: "none",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                background: "transparent",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              🚪 Logout
            </button>
          </div>
        ) : null}
      </div>
    </nav>
  );
}