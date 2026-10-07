"use client";

import { useState } from "react";

export function Code({ label, children }: { label?: string; children: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(children);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 1600);
  }

  return (
    <div className="code">
      {label && <div className="label">{label}</div>}
      <pre>
        <code>{children}</code>
      </pre>
      <button type="button" className="copy" onClick={handleCopy}>
        {state === "copied" ? "Copiado" : state === "failed" ? "Selecione e copie" : "Copiar"}
      </button>
    </div>
  );
}
