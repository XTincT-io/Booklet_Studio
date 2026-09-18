"use client";

import { useState, type FormEvent, type CSSProperties } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json().catch(() => ({}));
      setMessage(body.message || body.error || "If an account exists for that email, a reset link has been sent.");
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={wrapStyle}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Reset your password</h1>
      <p style={{ fontSize: 13, color: "#6b6b76", marginBottom: 22 }}>
        Enter your account email and we'll send you a reset link.
      </p>
      {message ? (
        <p style={{ fontSize: 14 }}>{message}</p>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input style={inputStyle} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <button style={btnStyle} type="submit" disabled={loading}>{loading ? "Sending…" : "Send reset link"}</button>
        </form>
      )}
      <p style={{ fontSize: 13, marginTop: 18 }}>
        <a href="/login" style={{ color: "#0a7" }}>Back to login</a>
      </p>
    </main>
  );
}

const wrapStyle: CSSProperties = { maxWidth: 360, margin: "90px auto", fontFamily: "system-ui, sans-serif", padding: "0 20px" };
const inputStyle: CSSProperties = { padding: "10px 12px", borderRadius: 6, border: "1px solid #d8d8dc", fontSize: 14 };
const btnStyle: CSSProperties = { padding: "10px 12px", borderRadius: 6, border: "none", background: "#141414", color: "#fff", fontSize: 14, cursor: "pointer" };
