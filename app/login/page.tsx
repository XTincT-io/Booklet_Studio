"use client";

import { useState, type FormEvent, type CSSProperties } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) setError("Incorrect email or password.");
    else router.push("/app");
  };

  return (
    <main style={wrapStyle}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Log in</h1>
      <p style={{ fontSize: 13, color: "#6b6b76", marginBottom: 22 }}>Welcome back to Booklet Studio.</p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input style={inputStyle} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input style={inputStyle} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <div style={{ color: "#c0392b", fontSize: 13 }}>{error}</div>}
        <button style={btnStyle} type="submit" disabled={loading}>{loading ? "Logging in…" : "Log in"}</button>
      </form>
      <p style={{ fontSize: 13, marginTop: 18 }}>
        No account? <a href="/signup" style={{ color: "#0a7" }}>Sign up</a>
      </p>
    </main>
  );
}

const wrapStyle: CSSProperties = { maxWidth: 360, margin: "90px auto", fontFamily: "system-ui, sans-serif", padding: "0 20px" };
const inputStyle: CSSProperties = { padding: "10px 12px", borderRadius: 6, border: "1px solid #d8d8dc", fontSize: 14 };
const btnStyle: CSSProperties = { padding: "10px 12px", borderRadius: 6, border: "none", background: "#141414", color: "#fff", fontSize: 14, cursor: "pointer" };
