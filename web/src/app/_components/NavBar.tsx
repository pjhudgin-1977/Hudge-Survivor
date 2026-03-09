"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  label: string;
  href: string;
  active: (pathname: string, base: string) => boolean;
};

export default function NavBar() {
  const pathname = usePathname();

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
      label: "Board",
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

  return (
    <nav
      style={{
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        alignItems: "center",
        marginBottom: 16,
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
    </nav>
  );
}