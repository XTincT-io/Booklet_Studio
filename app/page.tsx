import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { authOptions } from "@/lib/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session?.user) redirect("/app");

  return (
    <main style={wrap}>
      <div style={{ fontFamily: "'Share Tech Mono', monospace", color: "#ffb400", fontSize: 13, letterSpacing: 4, marginBottom: 18 }}>
        BOOKLET STUDIO
      </div>
      <h1 style={{ fontSize: 40, lineHeight: 1.15, margin: "0 0 18px", maxWidth: 620 }}>
        Interactive digital booklets for musicians and labels.
      </h1>
      <p style={{ fontSize: 16, color: "#a3a3ad", maxWidth: 540, marginBottom: 34 }}>
        Design a CD booklet, cassette J-card, or vinyl insert with linked audio, hotspots, and
        annotations — then export it as a high-res PDF, an embeddable web viewer, or a shareable
        image set.
      </p>
      <div style={{ display: "flex", gap: 14 }}>
        <a href="/signup" style={primaryBtn}>Start for free</a>
        <a href="/login" style={ghostBtn}>Log in</a>
      </div>
      <div style={{ marginTop: 50, fontSize: 12, color: "#6b6b76" }}>
        <a href="/terms" style={{ color: "#6b6b76", marginRight: 16 }}>Terms</a>
        <a href="/privacy" style={{ color: "#6b6b76" }}>Privacy</a>
      </div>
    </main>
  );
}

const wrap: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  padding: "0 8vw",
  background: "#0b0b10",
  color: "#e7e7ec",
  fontFamily: "system-ui, sans-serif",
};

const primaryBtn: CSSProperties = {
  display: "inline-block",
  background: "#ffb400",
  color: "#141414",
  fontWeight: 600,
  fontSize: 14,
  padding: "12px 20px",
  borderRadius: 6,
  textDecoration: "none",
};

const ghostBtn: CSSProperties = {
  display: "inline-block",
  background: "transparent",
  border: "1px solid #2a2a35",
  color: "#e7e7ec",
  fontSize: 14,
  padding: "12px 20px",
  borderRadius: 6,
  textDecoration: "none",
};
