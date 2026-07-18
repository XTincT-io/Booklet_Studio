"use client";

import { useState, type FormEvent, type CSSProperties } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Something went wrong." }));
      setError(body.error || "Something went wrong.");
      setLoading(false);
      return;
    }

    const signInRes = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (signInRes?.error) setError("Account created — please log in.");
    else router.push("/app");
  };

  return (
    <main style={wrapStyle}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Create your account</h1>
      <p style={{ fontSize: 13, color: "#6b6b76", marginBottom: 22 }}>
        Your first booklet is free — full creative flow, full export.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input style={inputStyle} type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input style={inputStyle} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input style={inputStyle} type="password" placeholder="Password (min 8 characters)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        {error && <div style={{ color: "#c0392b", fontSize: 13 }}>{error}</div>}
        <button style={btnStyle} type="submit" disabled={loading}>{loading ? "Creating…" : "Create account"}</button>
      </form>
      <p style={{ fontSize: 13, marginTop: 18 }}>
        Already have an account? <a href="/login" style={{ color: "#0a7" }}>Log in</a>
      </p>
    </main>
  );
}

const wrapStyle: CSSProperties = { maxWidth: 360, margin: "90px auto", fontFamily: "system-ui, sans-serif", padding: "0 20px" };
const inputStyle: CSSProperties = { padding: "10px 12px", borderRadius: 6, border: "1px solid #d8d8dc", fontSize: 14 };
const btnStyle: CSSProperties = { padding: "10px 12px", borderRadius: 6, border: "none", background: "#141414", color: "#fff", fontSize: 14, cursor: "pointer" };
