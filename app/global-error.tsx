"use client";

import { useEffect } from "react";
import { captureError } from "@/lib/monitoring";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    captureError(error, { digest: error.digest, source: "global-error-boundary" });
  }, [error]);

  return (
    <html>
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#0b0b10", color: "#e7e7ec", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <h1 style={{ fontSize: 20 }}>Something went wrong.</h1>
        <p style={{ color: "#a3a3ad", fontSize: 14 }}>The error has been logged. Try again, or come back in a moment.</p>
        <button
          onClick={reset}
          style={{ background: "#ffb400", color: "#141414", border: "none", borderRadius: 6, padding: "10px 18px", fontSize: 14, cursor: "pointer" }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
