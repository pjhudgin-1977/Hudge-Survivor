import React from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>Admin</h1>
        <p style={{ opacity: 0.85, marginTop: 6 }}>
          Commissioner tools for this pool.
        </p>
      </div>

      {children}
    </div>
  );
}