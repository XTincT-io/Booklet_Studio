"use client";

import { useState, type FormEvent, type CSSProperties, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Something went wrong." }));
      setError(body.error || "Something went wrong.");
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
    setTimeout(() => router.push("/login"), 2000);
  };

  if (!token) {
    return (
      <main style={wrapStyle}>
        <p style={{ fontSize: 14 }}>This reset link is missing its token. Please request a new one from the <a href="/forgot-password" style={{ color: "#0a7" }}>forgot password</a> page.</p>
      </main>
    );
  }

  return (
    <main style={wrapStyle}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Set a new password</h1>
      {done ? (
        <p style={{ fontSize: 14, marginTop: 16 }}>Password updated — redirecting you to login…</p>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}>
          <input style={inputStyle} type="password" placeholder="New password (min 8 characters)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
          {error && <div style={{ color: "#c0392b", fontSize: 13 }}>{error}</div>}
          <button style={btnStyle} type="submit" disabled={loading}>{loading ? "Saving…" : "Set new password"}</button>
        </form>
      )}
    </main>
  );
}

const wrapStyle: CSSProperties = { maxWidth: 360, margin: "90px auto", fontFamily: "system-ui, sans-serif", padding: "0 20px" };
const inputStyle: CSSProperties = { padding: "10px 12px", borderRadius: 6, border: "1px solid #d8d8dc", fontSize: 14 };
const btnStyle: CSSProperties = { padding: "10px 12px", borderRadius: 6, border: "none", background: "#141414", color: "#fff", fontSize: 14, cursor: "pointer" };
