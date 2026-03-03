"use client";

import { useEffect, useState } from "react";

export default function QRClient({ value }: { value: string }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    async function generate() {
      const QRCode = await import("qrcode");
      const url = await QRCode.default.toDataURL(value);
      setSrc(url);
    }

    if (value) generate();
  }, [value]);

  if (!src) return <div>Loading QR…</div>;

  return <img src={src} width={220} height={220} alt="QR Code" />;
}