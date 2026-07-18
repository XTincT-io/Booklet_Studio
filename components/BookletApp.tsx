"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  Home, Plus, Type, Image as ImageIcon, Square, Circle as CircleIcon,
  MousePointer2, Link2, Palette, Eye, EyeOff, Download, ChevronLeft,
  ChevronRight, Trash2, Copy, Layers as LayersIcon, Music, Settings,
  ChevronUp, ChevronDown, X, FileJson, Printer, Lock, ArrowLeft, ArrowRight,
  Pause, Play, LogOut, type LucideIcon,
} from "lucide-react";
import { api, uploadFileToOrg, ApiError } from "@/lib/api-client";
import type {
  OrgSummary, ProjectSummary, ProjectFull, PageData, BlockData,
  ThemeData, TierKey,
} from "@/lib/types";

/* ---------------------------------------------------------------------- */
/* Static reference data (mirrors the server's defaults)                   */
/* ---------------------------------------------------------------------- */

const FORMATS: Record<string, { id: string; label: string; w: number; h: number }> = {
  blank: { id: "blank", label: "Blank Canvas", w: 800, h: 1000 },
  cd: { id: "cd", label: "CD Booklet", w: 592, h: 592 },
  cassette: { id: "cassette", label: "Cassette J-Card", w: 864, h: 340 },
  vinyl: { id: "vinyl", label: "Vinyl Insert", w: 600, h: 600 },
};

const THEMES: (ThemeData & { name: string; locked: boolean })[] = [
  { id: "mono", name: "Monochrome", bg: "#f2f2f0", text: "#141414", accent: "#141414", texture: "none", fontHeadline: "Share Tech Mono", fontBody: "Inter", locked: false },
  { id: "neon", name: "Neon Cyberpunk", bg: "#0a0014", text: "#ecebff", accent: "#ff2e88", texture: "grain", fontHeadline: "Share Tech Mono", fontBody: "Inter", locked: true },
  { id: "analog", name: "Soft Analog", bg: "#efe6da", text: "#3a2f28", accent: "#c4744f", texture: "paper", fontHeadline: "Georgia", fontBody: "Inter", locked: true },
  { id: "archival", name: "Faded Archival", bg: "#e9e2d0", text: "#54503f", accent: "#8a7a52", texture: "noise", fontHeadline: "Times New Roman", fontBody: "Inter", locked: true },
  { id: "xerox", name: "Lo-fi Xerox", bg: "#f5f5f2", text: "#111111", accent: "#111111", texture: "xerox", fontHeadline: "Courier New", fontBody: "Inter", locked: true },
];

const FONT_CHOICES = ["Inter", "Share Tech Mono", "Georgia", "Courier New", "Times New Roman", "Arial Black", "Verdana"];

const TIER_LABELS: Record<TierKey, string> = {
  FREE: "Free Starter",
  INDIE_ARTIST: "Indie Artist",
  INDIE_LABEL: "Indie Label",
  ENTERPRISE: "Enterprise Label",
};
const TIER_MAX_PROJECTS: Record<TierKey, number> = {
  FREE: 1, INDIE_ARTIST: Infinity, INDIE_LABEL: Infinity, ENTERPRISE: Infinity,
};

function uid(prefix = "id") {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}

function textureDataUri(kind: string) {
  if (kind === "grain" || kind === "noise" || kind === "xerox") {
    const freq = kind === "xerox" ? 0.9 : kind === "grain" ? 0.75 : 0.6;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/></svg>`;
    return `url("data:image/svg+xml,${svg}")`;
  }
  if (kind === "paper") {
    return "repeating-linear-gradient(0deg, rgba(0,0,0,0.02) 0px, rgba(0,0,0,0.02) 1px, transparent 1px, transparent 3px)";
  }
  return "none";
}

function makeTextBlock(theme: ThemeData): BlockData {
  return { id: uid("blk"), type: "text", x: 40, y: 40, w: 220, h: 90, z: 1, hidden: false, content: "New text block", fontFamily: theme.fontBody, fontSize: 18, fontWeight: "400", color: theme.text, align: "left" };
}
function makeImageBlock(src: string): BlockData {
  return { id: uid("blk"), type: "image", x: 40, y: 40, w: 220, h: 220, z: 1, hidden: false, src, opacity: 1, fit: "cover" };
}
function makeShapeBlock(shape: "rect" | "circle"): BlockData {
  return { id: uid("blk"), type: "shape", shape, x: 40, y: 40, w: 160, h: 100, z: 1, hidden: false, fill: "#141414", opacity: 1 };
}
function makeHotspotBlock(): BlockData {
  return { id: uid("blk"), type: "hotspot", x: 40, y: 40, w: 130, h: 40, z: 1, hidden: false, label: "Hotspot", note: "Add a story note, translation, or annotation.", linkedAudioId: "", timestamp: 0 };
}
function makeAudioBlock(src: string, label: string): BlockData {
  return { id: uid("blk"), type: "audio", x: 40, y: 40, w: 200, h: 56, z: 1, hidden: false, src, label };
}

function useDebounced<Args extends unknown[]>(fn: (...args: Args) => void | Promise<void>, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback((...args: Args) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { fn(...args); }, delay);
  }, [fn, delay]);
}

/* ---------------------------------------------------------------------- */
/* Root component                                                          */
/* ---------------------------------------------------------------------- */

export default function BookletApp() {
  const { data: session, status } = useSession();
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [view, setView] = useState<"loading" | "dashboard" | "editor">("loading");
  const [activeProject, setActiveProject] = useState<ProjectFull | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [previewProject, setPreviewProject] = useState<ProjectFull | null>(null);
  const [saveFlash, setSaveFlash] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeOrg = orgs.find((o) => o.id === activeOrgId) || null;

  const flashSaved = () => {
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 1200);
  };

  const loadOrgsAndProjects = useCallback(async () => {
    try {
      const { orgs: fetchedOrgs } = await api.listOrgs();
      setOrgs(fetchedOrgs);
      const first = fetchedOrgs[0];
      if (!first) { setView("dashboard"); return; }
      setActiveOrgId(first.id);
      const { projects: fetchedProjects } = await api.listProjects(first.id);
      setProjects(fetchedProjects);
      setView("dashboard");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to load your workspace.");
      setView("dashboard");
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") loadOrgsAndProjects();
  }, [status, loadOrgsAndProjects]);

  const handleCreateProject = async (formatId: string, name: string, artist: string) => {
    if (!activeOrg) return;
    if (projects.length >= TIER_MAX_PROJECTS[activeOrg.tier]) {
      setShowNewModal(false);
      setShowUpgradeModal(true);
      return;
    }
    try {
      const { project } = await api.createProject({ orgId: activeOrg.id, name, artist, formatId });
      setProjects((prev) => [project, ...prev]);
      setActiveProject(project);
      setView("editor");
      setShowNewModal(false);
    } catch (e) {
      if (e instanceof ApiError && e.code === "TIER_LIMIT") {
        setShowNewModal(false);
        setShowUpgradeModal(true);
      } else {
        setErrorMsg(e instanceof Error ? e.message : "Couldn't create the project.");
      }
    }
  };

  const handleOpenProject = async (id: string) => {
    try {
      const { project } = await api.getProject(id);
      setActiveProject(project);
      setView("editor");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Couldn't open that project.");
    }
  };

  const handlePreviewProject = async (id: string) => {
    try {
      const { project } = await api.getProject(id);
      setPreviewProject(project);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Couldn't load the preview.");
    }
  };

  const handleDeleteProject = async (id: string) => {
    const prev = projects;
    setProjects((p) => p.filter((proj) => proj.id !== id));
    try {
      await api.deleteProject(id);
    } catch (e) {
      setProjects(prev);
      setErrorMsg(e instanceof Error ? e.message : "Couldn't delete the project.");
    }
  };

  if (status === "loading" || view === "loading") {
    return <div style={{ ...rootStyle, display: "flex", alignItems: "center", justifyContent: "center" }}><GlobalStyle /><span style={{ fontFamily: "var(--font-display)", color: "var(--ash)" }}>LOADING…</span></div>;
  }

  return (
    <div style={rootStyle}>
      <GlobalStyle />
      {errorMsg && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 300, background: "var(--void-panel)", border: "1px solid var(--alert)", color: "var(--ash-bright)", padding: "10px 14px", borderRadius: 8, fontSize: 13, maxWidth: 340 }}>
          {errorMsg}
          <button onClick={() => setErrorMsg(null)} style={{ display: "block", marginTop: 6, background: "none", border: "none", color: "var(--signal-cyan)", fontSize: 11 }}>Dismiss</button>
        </div>
      )}
      {view === "dashboard" && (
        <Dashboard
          projects={projects}
          org={activeOrg}
          userEmail={session?.user?.email || ""}
          saveFlash={saveFlash}
          onOpen={handleOpenProject}
          onPreview={handlePreviewProject}
          onDelete={handleDeleteProject}
          onNew={() => {
            if (activeOrg && projects.length >= TIER_MAX_PROJECTS[activeOrg.tier]) setShowUpgradeModal(true);
            else setShowNewModal(true);
          }}
        />
      )}
      {view === "editor" && activeProject && activeOrg && (
        <Editor
          project={activeProject}
          org={activeOrg}
          saveFlash={saveFlash}
          onFlashSaved={flashSaved}
          onError={(m) => setErrorMsg(m)}
          onProjectPatched={(patch) => {
            setActiveProject((p) => (p ? { ...p, ...patch } : p));
            setProjects((prev) => prev.map((p) => (p.id === activeProject.id ? { ...p, ...patch } : p)));
          }}
          onBack={() => { setView("dashboard"); setActiveProject(null); loadOrgsAndProjects(); }}
          onPreview={() => setPreviewProject(activeProject)}
          onRequestUpgrade={() => setShowUpgradeModal(true)}
        />
      )}
      {showNewModal && <NewProjectModal onClose={() => setShowNewModal(false)} onCreate={handleCreateProject} />}
      {showUpgradeModal && activeOrg && (
        <UpgradeModal
          org={activeOrg}
          onClose={() => setShowUpgradeModal(false)}
          onUpgraded={(tier) => {
            setOrgs((prev) => prev.map((o) => (o.id === activeOrg.id ? { ...o, tier } : o)));
            setShowUpgradeModal(false);
          }}
        />
      )}
      {previewProject && <PreviewViewer project={previewProject} onClose={() => setPreviewProject(null)} />}
    </div>
  );
}

const rootStyle: React.CSSProperties = { minHeight: "100vh", width: "100%", background: "var(--void-bg)", color: "var(--ash)", fontFamily: "var(--font-body)", position: "relative" };

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Inter:wght@400;500;600;700&display=swap');
      :root {
        --void-bg: #0b0b10; --void-panel: #15151c; --void-panel-2: #1c1c25; --void-border: #2a2a35;
        --crt-amber: #ffb400; --signal-cyan: #4de3ff; --ash: #a3a3ad; --ash-bright: #e7e7ec;
        --paper: #f2ede3; --alert: #ff4d5e;
        --font-display: 'Share Tech Mono', monospace; --font-body: 'Inter', system-ui, sans-serif;
      }
      * { box-sizing: border-box; }
      button { font-family: inherit; cursor: pointer; }
      input, textarea, select { font-family: inherit; }
      .bs-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
      .bs-scroll::-webkit-scrollbar-thumb { background: var(--void-border); border-radius: 4px; }
      .bs-scroll::-webkit-scrollbar-track { background: transparent; }
      @media print {
        body * { visibility: hidden; }
        .bs-print-root, .bs-print-root * { visibility: visible; }
        .bs-print-root { position: absolute; top: 0; left: 0; }
      }
    `}</style>
  );
}

/* ---------------------------------------------------------------------- */
/* Dashboard                                                               */
/* ---------------------------------------------------------------------- */

function Dashboard({
  projects, org, userEmail, saveFlash, onOpen, onPreview, onDelete, onNew,
}: {
  projects: ProjectSummary[]; org: OrgSummary | null; userEmail: string; saveFlash: boolean;
  onOpen: (id: string) => void; onPreview: (id: string) => void; onDelete: (id: string) => void; onNew: () => void;
}) {
  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 26 }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", color: "var(--crt-amber)", fontSize: 12, letterSpacing: 3 }}>BOOKLET STUDIO</div>
          <div style={{ fontSize: 22, color: "var(--ash-bright)", fontWeight: 600, marginTop: 4 }}>{org?.name || "Your Releases"}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <SaveIndicator show={saveFlash} />
          {org && <TierBadge tier={org.tier} />}
          <button onClick={onNew} style={primaryBtnStyle}><Plus size={15} /> New Release</button>
          <button onClick={() => signOut({ callbackUrl: "/login" })} title={userEmail} style={iconBtnStyle}><LogOut size={16} /></button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div style={{ border: "1px dashed var(--void-border)", borderRadius: 10, padding: "60px 30px", textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-display)", color: "var(--ash-bright)", fontSize: 15, marginBottom: 8 }}>NO RELEASES YET</div>
          <div style={{ fontSize: 13, marginBottom: 18 }}>Your first booklet is free — full creative flow, full export.</div>
          <button onClick={onNew} style={primaryBtnStyle}><Plus size={15} /> Create your first booklet</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 18 }}>
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} onOpen={() => onOpen(p.id)} onPreview={() => onPreview(p.id)} onDelete={() => onDelete(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function SaveIndicator({ show }: { show: boolean }) {
  return (
    <div style={{ fontFamily: "var(--font-display)", fontSize: 11, color: show ? "var(--crt-amber)" : "var(--void-border)", display: "flex", alignItems: "center", gap: 6, transition: "color .3s" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
      {show ? "SAVED" : "IDLE"}
    </div>
  );
}

function TierBadge({ tier }: { tier: TierKey }) {
  return (
    <div style={{ fontFamily: "var(--font-display)", fontSize: 11, letterSpacing: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--void-border)", color: "var(--signal-cyan)" }}>
      {TIER_LABELS[tier].toUpperCase()}
    </div>
  );
}

function ProjectCard({ project, onOpen, onPreview, onDelete }: { project: ProjectSummary; onOpen: () => void; onPreview: () => void; onDelete: () => void }) {
  const format = FORMATS[project.formatId] || FORMATS.blank;
  const theme = project.theme;
  return (
    <div style={{ background: "var(--void-panel)", border: "1px solid var(--void-border)", borderRadius: 10, overflow: "hidden" }}>
      <div onClick={onOpen} style={{ height: 130, cursor: "pointer", background: theme.bg, backgroundImage: textureDataUri(theme.texture), display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: theme.text, fontFamily: theme.fontHeadline, fontSize: 13, opacity: 0.75, textAlign: "center", padding: 10 }}>{project.name}</div>
      </div>
      <div style={{ padding: "12px 14px" }}>
        <div style={{ color: "var(--ash-bright)", fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{project.name}</div>
        <div style={{ fontSize: 12, color: "var(--ash)", marginBottom: 10 }}>{project.artist || "No artist set"} · {format.label}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onOpen} style={ghostBtnStyle}>Edit</button>
          <button onClick={onPreview} style={ghostBtnStyle}><Eye size={13} /></button>
          <button onClick={onDelete} style={{ ...ghostBtnStyle, marginLeft: "auto", color: "var(--alert)" }}><Trash2 size={13} /></button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* New Project / Upgrade modals                                            */
/* ---------------------------------------------------------------------- */

function NewProjectModal({ onClose, onCreate }: { onClose: () => void; onCreate: (formatId: string, name: string, artist: string) => void }) {
  const [formatId, setFormatId] = useState("blank");
  const [name, setName] = useState("");
  const [artist, setArtist] = useState("");

  return (
    <ModalShell onClose={onClose} title="New Release">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 18 }}>
        {Object.values(FORMATS).map((f) => (
          <button key={f.id} onClick={() => setFormatId(f.id)} style={{ ...ghostBtnStyle, flexDirection: "column", alignItems: "flex-start", height: 60, padding: 10, border: formatId === f.id ? "1px solid var(--signal-cyan)" : "1px solid var(--void-border)", color: formatId === f.id ? "var(--signal-cyan)" : "var(--ash-bright)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 12 }}>{f.label}</div>
            <div style={{ fontSize: 11, color: "var(--ash)" }}>{f.w} × {f.h}</div>
          </button>
        ))}
      </div>
      <label style={labelStyle}>Release title</label>
      <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Twilight Zone EP" />
      <label style={labelStyle}>Artist</label>
      <input style={inputStyle} value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="e.g. VOLUME" />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <button onClick={onClose} style={ghostBtnStyle}>Cancel</button>
        <button onClick={() => onCreate(formatId, name || "Untitled Release", artist)} style={primaryBtnStyle}>Create booklet</button>
      </div>
    </ModalShell>
  );
}

function UpgradeModal({ org, onClose, onUpgraded }: { org: OrgSummary; onClose: () => void; onUpgraded: (tier: TierKey) => void }) {
  const [busy, setBusy] = useState<TierKey | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const order: TierKey[] = ["FREE", "INDIE_ARTIST", "INDIE_LABEL", "ENTERPRISE"];
  const isDev = process.env.NODE_ENV !== "production";

  const selectTier = async (tier: TierKey) => {
    if (tier === "FREE" || tier === org.tier) return;
    if (tier === "ENTERPRISE") { setNote("Enterprise Label is arranged through sales rather than self-serve checkout."); return; }
    setBusy(tier);
    setNote(null);
    try {
      const { url } = await api.createCheckout(org.id, tier);
      window.location.href = url;
    } catch {
      if (isDev) {
        try {
          await api.devSetTier(org.id, tier);
          onUpgraded(tier);
          return;
        } catch (devErr) {
          setNote(devErr instanceof Error ? devErr.message : "Couldn't switch tier locally.");
        }
      } else {
        setNote("Checkout isn't configured yet — set your Stripe keys to enable self-serve upgrades.");
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <ModalShell onClose={onClose} title="Unlock more of the studio">
      <div style={{ fontSize: 13, color: "var(--ash)", marginBottom: 18, lineHeight: 1.5 }}>
        Your first booklet is complete and yours to keep. Ready for the next release, more design tools, or a team workflow?
      </div>
      {note && <div style={{ fontSize: 11, color: "var(--crt-amber)", marginBottom: 12 }}>{note}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {order.map((t) => (
          <button key={t} disabled={t === org.tier || busy !== null} onClick={() => selectTier(t)} style={{ ...ghostBtnStyle, justifyContent: "space-between", padding: "12px 14px", opacity: t === org.tier ? 0.4 : 1, border: "1px solid var(--void-border)" }}>
            <span style={{ fontFamily: "var(--font-display)" }}>{TIER_LABELS[t]}</span>
            <span style={{ fontSize: 11, color: "var(--signal-cyan)" }}>{t === org.tier ? "Current" : busy === t ? "…" : "Select"}</span>
          </button>
        ))}
      </div>
    </ModalShell>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "var(--void-panel)", border: "1px solid var(--void-border)", borderRadius: 12, padding: 24, width: 420, maxWidth: "90vw" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontFamily: "var(--font-display)", color: "var(--ash-bright)", fontSize: 15 }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--ash)" }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Editor                                                                   */
/* ---------------------------------------------------------------------- */

function Editor({
  project, org, saveFlash, onFlashSaved, onError, onProjectPatched, onBack, onPreview, onRequestUpgrade,
}: {
  project: ProjectFull; org: OrgSummary; saveFlash: boolean;
  onFlashSaved: () => void; onError: (m: string) => void;
  onProjectPatched: (patch: Partial<ProjectFull>) => void;
  onBack: () => void; onPreview: () => void; onRequestUpgrade: () => void;
}) {
  const format = FORMATS[project.formatId] || FORMATS.blank;
  const [pages, setPages] = useState<PageData[]>(project.pages);
  const [selectedPageId, setSelectedPageId] = useState<string>(project.pages[0]?.id);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [rightPanel, setRightPanel] = useState<"properties" | "theme" | "metadata">("properties");
  const [theme, setTheme] = useState<ThemeData>(project.theme);
  const [metadata, setMetadata] = useState(project.metadata);
  const [name, setName] = useState(project.name);
  const [scale, setScale] = useState(0.5);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const pendingToolRef = useRef<"image" | "audio" | null>(null);

  useEffect(() => {
    const compute = () => setScale(Math.min(560 / format.w, 620 / format.h, 1));
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [format.w, format.h]);

  const page = pages.find((pg) => pg.id === selectedPageId) || pages[0];
  const selectedBlock = page?.blocks.find((b) => b.id === selectedBlockId) || null;

  /* --- persistence: debounced network writes, optimistic local state --- */

  const savePageBlocks = useDebounced(async (pageId: string, blocks: BlockData[]) => {
    try {
      await api.updatePage(project.id, pageId, { blocks });
      onFlashSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't save that page.");
    }
  }, 600);

  const saveProjectFields = useDebounced(async (patch: Partial<{ name: string; artist: string; metadata: typeof metadata; theme: ThemeData }>) => {
    try {
      await api.updateProject(project.id, patch);
      onProjectPatched(patch);
      onFlashSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't save the project.");
    }
  }, 600);

  const setBlocksForPage = (pageId: string, updater: (blocks: BlockData[]) => BlockData[]) => {
    setPages((prev) => prev.map((pg) => {
      if (pg.id !== pageId) return pg;
      const nextBlocks = updater(pg.blocks);
      savePageBlocks(pageId, nextBlocks);
      return { ...pg, blocks: nextBlocks };
    }));
  };

  const addBlock = (block: BlockData) => {
    setBlocksForPage(page.id, (blocks) => [...blocks, { ...block, z: blocks.length + 1 }]);
    setSelectedBlockId(block.id);
  };

  const updateBlock = (blockId: string, patch: Partial<BlockData>) => {
    setBlocksForPage(page.id, (blocks) => blocks.map((b) => (b.id === blockId ? ({ ...b, ...patch } as BlockData) : b)));
  };

  const deleteBlock = (blockId: string) => {
    setBlocksForPage(page.id, (blocks) => blocks.filter((b) => b.id !== blockId));
    if (selectedBlockId === blockId) setSelectedBlockId(null);
  };

  const moveBlockZ = (blockId: string, dir: "up" | "down") => {
    setBlocksForPage(page.id, (blocks) => {
      const sorted = [...blocks].sort((a, b) => a.z - b.z);
      const idx = sorted.findIndex((b) => b.id === blockId);
      const swapIdx = dir === "up" ? idx + 1 : idx - 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return blocks;
      const a = sorted[idx], b = sorted[swapIdx];
      const az = a.z, bz = b.z;
      return blocks.map((blk) => (blk.id === a.id ? { ...blk, z: bz } : blk.id === b.id ? { ...blk, z: az } : blk));
    });
  };

  const handleToolClick = (tool: string) => {
    if (tool === "text") addBlock(makeTextBlock(theme));
    else if (tool === "rect") addBlock(makeShapeBlock("rect"));
    else if (tool === "circle") addBlock(makeShapeBlock("circle"));
    else if (tool === "hotspot") addBlock(makeHotspotBlock());
    else if (tool === "image") { pendingToolRef.current = "image"; fileInputRef.current?.click(); }
    else if (tool === "audio") { pendingToolRef.current = "audio"; audioInputRef.current?.click(); }
  };

  const handleFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const url = await uploadFileToOrg(org.id, file);
      if (pendingToolRef.current === "image") addBlock(makeImageBlock(url));
      else if (pendingToolRef.current === "audio") addBlock(makeAudioBlock(url, file.name.replace(/\.[^.]+$/, "")));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Upload failed. Check that asset storage is configured.");
    }
  };

  const addPage = async (duplicate: boolean) => {
    try {
      const { page: newPage } = await api.createPage(project.id, {
        name: duplicate ? page.name + " copy" : "New page",
        blocks: duplicate ? page.blocks.map((b) => ({ ...b, id: uid("blk") })) : [],
      });
      setPages((prev) => {
        const idx = prev.findIndex((pg) => pg.id === page.id);
        const next = [...prev];
        next.splice(idx + 1, 0, newPage);
        return next;
      });
      setSelectedPageId(newPage.id);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't add a page.");
    }
  };

  const deletePage = async (pageId: string) => {
    if (pages.length <= 1) return;
    const prev = pages;
    setPages((p) => p.filter((pg) => pg.id !== pageId));
    try {
      await api.deletePage(project.id, pageId);
    } catch (e) {
      setPages(prev);
      onError(e instanceof Error ? e.message : "Couldn't delete that page.");
    }
  };

  const reorderPage = (pageId: string, dir: "left" | "right") => {
    setPages((prev) => {
      const idx = prev.findIndex((pg) => pg.id === pageId);
      const swap = dir === "left" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      next.forEach((pg, i) => { if (pg.order !== i) api.updatePage(project.id, pg.id, { order: i }).catch(() => {}); });
      return next.map((pg, i) => ({ ...pg, order: i }));
    });
  };

  const applyTheme = (themeId: string) => {
    const t = THEMES.find((th) => th.id === themeId);
    if (!t) return;
    if (t.locked && org.tier === "FREE") { onRequestUpgrade(); return; }
    const nextTheme: ThemeData = { id: t.id, bg: t.bg, text: t.text, accent: t.accent, texture: t.texture, fontHeadline: theme.fontHeadline, fontBody: theme.fontBody };
    setTheme(nextTheme);
    saveProjectFields({ theme: nextTheme });
  };

  const updateTypography = (key: "fontHeadline" | "fontBody", value: string) => {
    const nextTheme = { ...theme, [key]: value };
    setTheme(nextTheme);
    saveProjectFields({ theme: nextTheme });
  };

  const updateMetadataField = (key: keyof typeof metadata, value: string) => {
    const next = { ...metadata, [key]: value };
    setMetadata(next);
    saveProjectFields({ metadata: next });
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify({ ...project, name, theme, metadata, pages }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${name.replace(/\s+/g, "_")}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChosen} />
      <input ref={audioInputRef} type="file" accept="audio/*" style={{ display: "none" }} onChange={handleFileChosen} />

      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", borderBottom: "1px solid var(--void-border)", background: "var(--void-panel)" }}>
        <button onClick={onBack} style={iconBtnStyle} title="Back to dashboard"><Home size={16} /></button>
        <div style={{ width: 1, height: 22, background: "var(--void-border)", margin: "0 6px" }} />
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); saveProjectFields({ name: e.target.value }); }}
          style={{ ...inputStyle, width: 220, background: "transparent", border: "none", fontFamily: "var(--font-display)", fontSize: 13, padding: "4px 6px" }}
        />
        <div style={{ width: 1, height: 22, background: "var(--void-border)", margin: "0 6px" }} />
        <ToolButton icon={MousePointer2} label="Select" onClick={() => setSelectedBlockId(null)} />
        <ToolButton icon={Type} label="Text" onClick={() => handleToolClick("text")} />
        <ToolButton icon={ImageIcon} label="Image" onClick={() => handleToolClick("image")} />
        <ToolButton icon={Music} label="Audio" onClick={() => handleToolClick("audio")} />
        <ToolButton icon={Square} label="Rectangle" onClick={() => handleToolClick("rect")} />
        <ToolButton icon={CircleIcon} label="Circle" onClick={() => handleToolClick("circle")} />
        <ToolButton icon={Link2} label="Hotspot" onClick={() => handleToolClick("hotspot")} />
        <div style={{ width: 1, height: 22, background: "var(--void-border)", margin: "0 6px" }} />
        <ToolButton icon={Palette} label="Theme" onClick={() => setRightPanel("theme")} active={rightPanel === "theme"} />
        <ToolButton icon={Settings} label="Details" onClick={() => setRightPanel("metadata")} active={rightPanel === "metadata"} />
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <SaveIndicator show={saveFlash} />
          <TierBadge tier={org.tier} />
          <button onClick={onPreview} style={ghostBtnStyle}><Eye size={14} /> Preview</button>
          <ExportMenu onExportJSON={exportJSON} />
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div style={{ width: 220, borderRight: "1px solid var(--void-border)", display: "flex", flexDirection: "column", background: "var(--void-panel)" }}>
          <PanelHeader label="Pages" />
          <div className="bs-scroll" style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", maxHeight: "40%" }}>
            {pages.map((pg, i) => (
              <div key={pg.id} onClick={() => setSelectedPageId(pg.id)} style={{ border: pg.id === selectedPageId ? "1px solid var(--signal-cyan)" : "1px solid var(--void-border)", borderRadius: 6, padding: "8px 10px", cursor: "pointer", fontSize: 12, color: pg.id === selectedPageId ? "var(--signal-cyan)" : "var(--ash)", display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{i + 1}. {pg.name}</span>
                  {pages.length > 1 && <span onClick={(e) => { e.stopPropagation(); deletePage(pg.id); }} style={{ color: "var(--alert)" }}><X size={12} /></span>}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <span onClick={(e) => { e.stopPropagation(); reorderPage(pg.id, "left"); }}><ChevronLeft size={12} /></span>
                  <span onClick={(e) => { e.stopPropagation(); reorderPage(pg.id, "right"); }}><ChevronRight size={12} /></span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: 10, display: "flex", gap: 6, borderBottom: "1px solid var(--void-border)" }}>
            <button onClick={() => addPage(false)} style={{ ...ghostBtnStyle, flex: 1 }}>+ Page</button>
            <button onClick={() => addPage(true)} style={{ ...ghostBtnStyle, flex: 1 }}><Copy size={12} /> Dup</button>
          </div>

          <PanelHeader label="Layers" icon={LayersIcon} />
          <div className="bs-scroll" style={{ padding: 10, display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", flex: 1 }}>
            {(page?.blocks || []).slice().sort((a, b) => b.z - a.z).map((b) => (
              <div key={b.id} onClick={() => setSelectedBlockId(b.id)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "6px 8px", borderRadius: 6, background: b.id === selectedBlockId ? "var(--void-panel-2)" : "transparent", color: b.hidden ? "var(--void-border)" : "var(--ash)", cursor: "pointer" }}>
                <BlockTypeIcon type={b.type} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.type === "text" ? b.content.slice(0, 16) : b.type}</span>
                <span onClick={(e) => { e.stopPropagation(); updateBlock(b.id, { hidden: !b.hidden }); }}>{b.hidden ? <EyeOff size={12} /> : <Eye size={12} />}</span>
                <span onClick={(e) => { e.stopPropagation(); moveBlockZ(b.id, "up"); }}><ChevronUp size={12} /></span>
                <span onClick={(e) => { e.stopPropagation(); moveBlockZ(b.id, "down"); }}><ChevronDown size={12} /></span>
                <span onClick={(e) => { e.stopPropagation(); deleteBlock(b.id); }} style={{ color: "var(--alert)" }}><Trash2 size={12} /></span>
              </div>
            ))}
            {(!page || page.blocks.length === 0) && <div style={{ fontSize: 11, color: "var(--void-border)" }}>No blocks on this page yet.</div>}
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto", background: "#050507" }}>
          {page && (
            <div onPointerDown={() => setSelectedBlockId(null)} style={{ width: format.w * scale, height: format.h * scale, position: "relative", background: theme.bg, backgroundImage: textureDataUri(theme.texture), boxShadow: "0 20px 60px rgba(0,0,0,0.6)", overflow: "hidden" }}>
              {page.blocks.filter((b) => !b.hidden).map((b) => (
                <CanvasBlock key={b.id} block={b} scale={scale} selected={b.id === selectedBlockId} onSelect={() => setSelectedBlockId(b.id)} onChange={(patch) => updateBlock(b.id, patch)} />
              ))}
            </div>
          )}
        </div>

        <div style={{ width: 260, borderLeft: "1px solid var(--void-border)", background: "var(--void-panel)", overflowY: "auto" }} className="bs-scroll">
          {rightPanel === "theme" && <ThemePanel theme={theme} orgTier={org.tier} onApplyTheme={applyTheme} onUpdateTypography={updateTypography} />}
          {rightPanel === "metadata" && <MetadataPanel metadata={metadata} onChange={updateMetadataField} />}
          {rightPanel === "properties" && (
            selectedBlock
              ? <PropertiesPanel block={selectedBlock} page={page} onChange={(patch) => updateBlock(selectedBlock.id, patch)} />
              : <div style={{ padding: 16, fontSize: 12, color: "var(--void-border)" }}>Select a block to edit its properties, or use Theme / Details above.</div>
          )}
          {(rightPanel === "theme" || rightPanel === "metadata") && (
            <div style={{ padding: 10 }}><button onClick={() => setRightPanel("properties")} style={{ ...ghostBtnStyle, width: "100%" }}>Back to properties</button></div>
          )}
        </div>
      </div>
    </div>
  );
}

function PanelHeader({ label, icon: Icon }: { label: string; icon?: LucideIcon }) {
  return <div style={{ padding: "10px 12px", fontFamily: "var(--font-display)", fontSize: 11, letterSpacing: 1, color: "var(--ash)", borderBottom: "1px solid var(--void-border)", display: "flex", alignItems: "center", gap: 6 }}>{Icon && <Icon size={12} />} {label.toUpperCase()}</div>;
}

function BlockTypeIcon({ type }: { type: BlockData["type"] }) {
  const map: Record<BlockData["type"], LucideIcon> = { text: Type, image: ImageIcon, audio: Music, shape: Square, hotspot: Link2 };
  const Icon = map[type];
  return <Icon size={12} />;
}

function ToolButton({ icon: Icon, label, onClick, active }: { icon: LucideIcon; label: string; onClick: () => void; active?: boolean }) {
  return <button onClick={onClick} title={label} style={{ ...iconBtnStyle, background: active ? "var(--void-panel-2)" : "transparent", color: active ? "var(--signal-cyan)" : "var(--ash)" }}><Icon size={16} /></button>;
}

function ExportMenu({ onExportJSON }: { onExportJSON: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)} style={primaryBtnStyle}><Download size={14} /> Export</button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "110%", background: "var(--void-panel-2)", border: "1px solid var(--void-border)", borderRadius: 8, overflow: "hidden", zIndex: 20, minWidth: 190 }}>
          <button onClick={() => { onExportJSON(); setOpen(false); }} style={menuItemStyle}><FileJson size={13} /> Export as JSON</button>
          <button onClick={() => { window.print(); setOpen(false); }} style={menuItemStyle}><Printer size={13} /> Print / Save as PDF</button>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Canvas block                                                            */
/* ---------------------------------------------------------------------- */

function CanvasBlock({ block, scale, selected, onSelect, onChange }: { block: BlockData; scale: number; selected: boolean; onSelect: () => void; onChange: (patch: Partial<BlockData>) => void }) {
  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    onSelect();
    const startX = e.clientX, startY = e.clientY, startBX = block.x, startBY = block.y;
    const onMove = (ev: PointerEvent) => onChange({ x: startBX + (ev.clientX - startX) / scale, y: startBY + (ev.clientY - startY) / scale });
    const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleResizeDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const startX = e.clientX, startY = e.clientY, startW = block.w, startH = block.h;
    const onMove = (ev: PointerEvent) => onChange({ w: Math.max(30, startW + (ev.clientX - startX) / scale), h: Math.max(20, startH + (ev.clientY - startY) / scale) });
    const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div onPointerDown={handlePointerDown} style={{ position: "absolute", left: block.x * scale, top: block.y * scale, width: block.w * scale, height: block.h * scale, zIndex: block.z, outline: selected ? "2px solid var(--signal-cyan)" : "1px dashed transparent", cursor: "move" }}>
      <BlockContent block={block} scale={scale} />
      {selected && <div onPointerDown={handleResizeDown} style={{ position: "absolute", right: -6, bottom: -6, width: 12, height: 12, background: "var(--signal-cyan)", cursor: "nwse-resize", borderRadius: 2 }} />}
    </div>
  );
}

function BlockContent({ block, scale }: { block: BlockData; scale: number }) {
  if (block.type === "text") {
    return <div style={{ width: "100%", height: "100%", fontFamily: block.fontFamily, fontSize: block.fontSize * scale, fontWeight: block.fontWeight, color: block.color, textAlign: block.align as React.CSSProperties["textAlign"], overflow: "hidden", padding: 4, whiteSpace: "pre-wrap", pointerEvents: "none" }}>{block.content}</div>;
  }
  if (block.type === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={block.src} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: block.fit as React.CSSProperties["objectFit"], opacity: block.opacity, pointerEvents: "none" }} />;
  }
  if (block.type === "shape") {
    return <div style={{ width: "100%", height: "100%", background: block.fill, opacity: block.opacity, borderRadius: block.shape === "circle" ? "50%" : 0 }} />;
  }
  if (block.type === "hotspot") {
    return <div style={{ width: "100%", height: "100%", border: "1px dashed var(--signal-cyan)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 * scale + 8, color: "var(--signal-cyan)", background: "rgba(77,227,255,0.08)", pointerEvents: "none" }}>{block.label}</div>;
  }
  if (block.type === "audio") {
    return <div style={{ width: "100%", height: "100%", border: "1px solid var(--void-border)", borderRadius: 8, display: "flex", alignItems: "center", gap: 8, padding: "0 10px", background: "var(--void-panel-2)", pointerEvents: "none" }}><Music size={14} color="var(--crt-amber)" /><span style={{ fontSize: 11, color: "var(--ash)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{block.label}</span></div>;
  }
  return null;
}

/* ---------------------------------------------------------------------- */
/* Properties / Theme / Metadata panels                                    */
/* ---------------------------------------------------------------------- */

function PropertiesPanel({ block, page, onChange }: { block: BlockData; page: PageData; onChange: (patch: Partial<BlockData>) => void }) {
  return (
    <div style={{ padding: 14 }}>
      <PanelHeader label={`${block.type} properties`} />
      <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {block.type === "text" && (
          <>
            <label style={labelStyle}>Content</label>
            <textarea style={{ ...inputStyle, minHeight: 70 }} value={block.content} onChange={(e) => onChange({ content: e.target.value })} />
            <label style={labelStyle}>Font</label>
            <select style={inputStyle} value={block.fontFamily} onChange={(e) => onChange({ fontFamily: e.target.value })}>{FONT_CHOICES.map((f) => <option key={f} value={f}>{f}</option>)}</select>
            <label style={labelStyle}>Size</label>
            <input type="range" min="10" max="72" value={block.fontSize} onChange={(e) => onChange({ fontSize: Number(e.target.value) })} />
            <label style={labelStyle}>Weight</label>
            <select style={inputStyle} value={block.fontWeight} onChange={(e) => onChange({ fontWeight: e.target.value })}><option value="300">Light</option><option value="400">Regular</option><option value="600">Semibold</option><option value="700">Bold</option></select>
            <label style={labelStyle}>Align</label>
            <select style={inputStyle} value={block.align} onChange={(e) => onChange({ align: e.target.value })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option><option value="justify">Justify</option></select>
            <label style={labelStyle}>Color</label>
            <input type="color" value={block.color} onChange={(e) => onChange({ color: e.target.value })} style={{ width: "100%", height: 32 }} />
          </>
        )}
        {block.type === "image" && (
          <>
            <label style={labelStyle}>Opacity</label>
            <input type="range" min="0" max="1" step="0.05" value={block.opacity} onChange={(e) => onChange({ opacity: Number(e.target.value) })} />
            <label style={labelStyle}>Fit</label>
            <select style={inputStyle} value={block.fit} onChange={(e) => onChange({ fit: e.target.value })}><option value="cover">Cover</option><option value="contain">Contain</option><option value="fill">Fill</option></select>
          </>
        )}
        {block.type === "shape" && (
          <>
            <label style={labelStyle}>Fill color</label>
            <input type="color" value={block.fill} onChange={(e) => onChange({ fill: e.target.value })} style={{ width: "100%", height: 32 }} />
            <label style={labelStyle}>Opacity</label>
            <input type="range" min="0" max="1" step="0.05" value={block.opacity} onChange={(e) => onChange({ opacity: Number(e.target.value) })} />
          </>
        )}
        {block.type === "hotspot" && (
          <>
            <label style={labelStyle}>Label</label>
            <input style={inputStyle} value={block.label} onChange={(e) => onChange({ label: e.target.value })} />
            <label style={labelStyle}>Note / annotation shown on click</label>
            <textarea style={{ ...inputStyle, minHeight: 60 }} value={block.note} onChange={(e) => onChange({ note: e.target.value })} />
            <label style={labelStyle}>Jump to audio track</label>
            <select style={inputStyle} value={block.linkedAudioId} onChange={(e) => onChange({ linkedAudioId: e.target.value })}>
              <option value="">None</option>
              {page.blocks.filter((b): b is Extract<BlockData, { type: "audio" }> => b.type === "audio").map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
            <label style={labelStyle}>Timestamp (seconds)</label>
            <input type="number" min="0" style={inputStyle} value={block.timestamp} onChange={(e) => onChange({ timestamp: Number(e.target.value) })} />
          </>
        )}
        {block.type === "audio" && <div style={{ fontSize: 12, color: "var(--ash)" }}>Link a hotspot to this track to let readers jump to a lyric timestamp in Preview.</div>}
      </div>
    </div>
  );
}

function ThemePanel({ theme, orgTier, onApplyTheme, onUpdateTypography }: { theme: ThemeData; orgTier: TierKey; onApplyTheme: (id: string) => void; onUpdateTypography: (key: "fontHeadline" | "fontBody", value: string) => void }) {
  return (
    <div style={{ padding: 14 }}>
      <PanelHeader label="Theme presets" icon={Palette} />
      <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {THEMES.map((t) => {
          const isLocked = t.locked && orgTier === "FREE";
          return (
            <button key={t.id} onClick={() => onApplyTheme(t.id)} style={{ ...ghostBtnStyle, justifyContent: "space-between", padding: "10px 12px", border: theme.id === t.id ? "1px solid var(--signal-cyan)" : "1px solid var(--void-border)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 16, height: 16, borderRadius: 4, background: t.bg, border: "1px solid var(--void-border)" }} />{t.name}</span>
              {isLocked && <Lock size={12} color="var(--crt-amber)" />}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 18 }}>
        <PanelHeader label="Typography" />
        <div style={{ paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={labelStyle}>Headline font</label>
          <select style={inputStyle} value={theme.fontHeadline} onChange={(e) => onUpdateTypography("fontHeadline", e.target.value)}>{FONT_CHOICES.map((f) => <option key={f} value={f}>{f}</option>)}</select>
          <label style={labelStyle}>Body font</label>
          <select style={inputStyle} value={theme.fontBody} onChange={(e) => onUpdateTypography("fontBody", e.target.value)}>{FONT_CHOICES.map((f) => <option key={f} value={f}>{f}</option>)}</select>
        </div>
      </div>
    </div>
  );
}

function MetadataPanel({ metadata, onChange }: { metadata: ProjectFull["metadata"]; onChange: (key: keyof ProjectFull["metadata"], value: string) => void }) {
  const fields: [keyof ProjectFull["metadata"], string][] = [
    ["title", "Title"], ["artist", "Artist"], ["releaseDate", "Release date"], ["label", "Label / imprint"],
    ["catalogNumber", "Catalog number"], ["contributors", "Contributors"], ["tracklist", "Tracklist"], ["notes", "Notes"],
  ];
  const longFields = new Set(["tracklist", "notes", "contributors"]);
  return (
    <div style={{ padding: 14 }}>
      <PanelHeader label="Release details" icon={Settings} />
      <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {fields.map(([key, label]) => (
          <div key={key}>
            <label style={labelStyle}>{label}</label>
            {longFields.has(key)
              ? <textarea style={{ ...inputStyle, minHeight: 56 }} value={metadata[key]} onChange={(e) => onChange(key, e.target.value)} />
              : <input style={inputStyle} value={metadata[key]} onChange={(e) => onChange(key, e.target.value)} />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Preview viewer                                                          */
/* ---------------------------------------------------------------------- */

function PreviewViewer({ project, onClose }: { project: ProjectFull; onClose: () => void }) {
  const format = FORMATS[project.formatId] || FORMATS.blank;
  const [pageIndex, setPageIndex] = useState(0);
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const [playingId, setPlayingId] = useState<string | null>(null);

  const page = project.pages[pageIndex];

  const go = useCallback((dir: number) => {
    setActiveNote(null);
    setPageIndex((i) => Math.max(0, Math.min(project.pages.length - 1, i + dir)));
  }, [project.pages.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  const scale = Math.min(700 / format.w, 760 / format.h);

  const handleHotspotClick = (block: Extract<BlockData, { type: "hotspot" }>) => {
    if (block.linkedAudioId) {
      const el = audioRefs.current[block.linkedAudioId];
      if (el) { el.currentTime = block.timestamp || 0; el.play(); setPlayingId(block.linkedAudioId); }
    }
    setActiveNote(block.note || null);
  };

  const toggleAudio = (block: Extract<BlockData, { type: "audio" }>) => {
    const el = audioRefs.current[block.id];
    if (!el) return;
    if (playingId === block.id) { el.pause(); setPlayingId(null); } else { el.play(); setPlayingId(block.id); }
  };

  if (!page) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 200, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px" }}>
        <div style={{ fontFamily: "var(--font-display)", color: "var(--ash-bright)", fontSize: 13 }}>{project.name} — Preview</div>
        <button onClick={onClose} style={iconBtnStyle}><X size={18} color="var(--ash-bright)" /></button>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <button onClick={() => go(-1)} disabled={pageIndex === 0} style={{ ...iconBtnStyle, position: "absolute", left: 20, opacity: pageIndex === 0 ? 0.3 : 1 }}><ArrowLeft size={22} color="var(--ash-bright)" /></button>
        <div key={page.id} style={{ width: format.w * scale, height: format.h * scale, position: "relative", background: project.theme.bg, backgroundImage: textureDataUri(project.theme.texture), boxShadow: "0 30px 90px rgba(0,0,0,0.7)" }}>
          {page.blocks.filter((b) => !b.hidden).map((b) => {
            if (b.type === "audio") {
              return (
                <div key={b.id} style={{ position: "absolute", left: b.x * scale, top: b.y * scale, width: b.w * scale, height: b.h * scale }}>
                  <audio ref={(el) => { if (el) audioRefs.current[b.id] = el; }} src={b.src} onEnded={() => setPlayingId(null)} />
                  <button onClick={() => toggleAudio(b)} style={{ width: "100%", height: "100%", border: "1px solid var(--void-border)", borderRadius: 8, background: "var(--void-panel-2)", display: "flex", alignItems: "center", gap: 8, padding: "0 10px" }}>
                    {playingId === b.id ? <Pause size={14} color="var(--crt-amber)" /> : <Play size={14} color="var(--crt-amber)" />}
                    <span style={{ fontSize: 11, color: "var(--ash-bright)" }}>{b.label}</span>
                  </button>
                </div>
              );
            }
            if (b.type === "hotspot") {
              return (
                <div key={b.id} onClick={() => handleHotspotClick(b)} title={b.label}
                  style={{ position: "absolute", left: b.x * scale, top: b.y * scale, width: b.w * scale, height: b.h * scale, border: "1px solid transparent", borderRadius: 6, cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.border = "1px solid var(--signal-cyan)")}
                  onMouseLeave={(e) => (e.currentTarget.style.border = "1px solid transparent")}
                />
              );
            }
            return <div key={b.id} style={{ position: "absolute", left: b.x * scale, top: b.y * scale, width: b.w * scale, height: b.h * scale, zIndex: b.z }}><BlockContent block={b} scale={scale} /></div>;
          })}
        </div>
        <button onClick={() => go(1)} disabled={pageIndex === project.pages.length - 1} style={{ ...iconBtnStyle, position: "absolute", right: 20, opacity: pageIndex === project.pages.length - 1 ? 0.3 : 1 }}><ArrowRight size={22} color="var(--ash-bright)" /></button>
        {activeNote && (
          <div style={{ position: "absolute", bottom: 30, background: "var(--void-panel)", border: "1px solid var(--signal-cyan)", borderRadius: 8, padding: "12px 16px", maxWidth: 420, fontSize: 13, color: "var(--ash-bright)" }}>
            {activeNote}
            <button onClick={() => setActiveNote(null)} style={{ display: "block", marginTop: 8, background: "none", border: "none", color: "var(--signal-cyan)", fontSize: 11 }}>Close</button>
          </div>
        )}
      </div>
      <div style={{ textAlign: "center", padding: "10px 0", fontSize: 11, color: "var(--ash)", fontFamily: "var(--font-display)" }}>PAGE {pageIndex + 1} / {project.pages.length} — use ← → keys, click hotspots for notes</div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Shared style tokens                                                     */
/* ---------------------------------------------------------------------- */

const primaryBtnStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, background: "var(--crt-amber)", color: "#141414", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 600 };
const ghostBtnStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, background: "transparent", color: "var(--ash-bright)", border: "1px solid var(--void-border)", borderRadius: 6, padding: "8px 12px", fontSize: 12 };
const iconBtnStyle: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", borderRadius: 6, padding: 8, color: "var(--ash)" };
const inputStyle: React.CSSProperties = { width: "100%", background: "var(--void-panel-2)", border: "1px solid var(--void-border)", borderRadius: 6, padding: "8px 10px", fontSize: 12, color: "var(--ash-bright)", outline: "none" };
const labelStyle: React.CSSProperties = { fontSize: 11, color: "var(--ash)", textTransform: "uppercase", letterSpacing: 0.5 };
const menuItemStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 12px", background: "transparent", border: "none", color: "var(--ash-bright)", fontSize: 12, textAlign: "left" };
