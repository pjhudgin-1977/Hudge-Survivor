"use client";

import { usePathname } from "next/navigation";
import AppNav from "./AppNav";

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Hide nav on auth pages
  const hideNav =
    pathname === "/login" ||
    pathname === "/reset-password" ||
    pathname.startsWith("/reset-password");

  return (
    <>
      {!hideNav ? <AppNav /> : null}
      {children}
    </>
  );
}