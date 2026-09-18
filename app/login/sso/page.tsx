"use client";

import { useState, type FormEvent, type CSSProperties } from "react";

export default function SsoEntryPage() {
  const [slug, setSlug] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!slug.trim()) return;
    window.location.href = `/api/sso/${encodeURIComponent(slug.trim())}/login`;
  };

  return (
    <main style={wrapStyle}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Single sign-on</h1>
      <p style={{ fontSize: 13, color: "#6b6b76", marginBottom: 22 }}>
        Enter your organization's Booklet Studio login slug — your admin can find this under Team → SSO Settings.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input style={inputStyle} type="text" placeholder="e.g. atlas-records" value={slug} onChange={(e) => setSlug(e.target.value)} required />
        <button style={btnStyle} type="submit">Continue</button>
      </form>
      <p style={{ fontSize: 13, marginTop: 18 }}>
        <a href="/login" style={{ color: "#0a7" }}>Back to regular login</a>
      </p>
    </main>
  );
}

const wrapStyle: CSSProperties = { maxWidth: 360, margin: "90px auto", fontFamily: "system-ui, sans-serif", padding: "0 20px" };
const inputStyle: CSSProperties = { padding: "10px 12px", borderRadius: 6, border: "1px solid #d8d8dc", fontSize: 14 };
const btnStyle: CSSProperties = { padding: "10px 12px", borderRadius: 6, border: "none", background: "#141414", color: "#fff", fontSize: 14, cursor: "pointer" };
