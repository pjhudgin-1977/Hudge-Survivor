"use client";

import { useState } from "react";

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // fallback: do nothing (clipboard can fail in some browsers)
    }
  }

  return (
    <button
      onClick={onCopy}
      className="rounded-lg border px-3 py-2 text-sm hover:bg-white/5"
      type="button"
    >
      {copied ? "Copied!" : "Copy link"}
    </button>
  );
}