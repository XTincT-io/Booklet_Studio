import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Home, Plus, Type, Image as ImageIcon, Square, Circle as CircleIcon,
  MousePointer2, Link2, Palette, Eye, EyeOff, Download, ChevronLeft,
  ChevronRight, Trash2, Copy, ArrowUp, ArrowDown, X, FileJson, Printer,
  Lock, Layers as LayersIcon, Music, Settings, Save, ChevronUp, ChevronDown,
  ArrowLeft, ArrowRight, Volume2, Pause, Play
} from "lucide-react";

/* ---------------------------------------------------------------------- */
/* Data model                                                              */
/* ---------------------------------------------------------------------- */

const FORMATS = {
  blank: { id: "blank", label: "Blank Canvas", w: 800, h: 1000, pageNames: ["Page 1"] },
  cd: { id: "cd", label: "CD Booklet", w: 592, h: 592, pageNames: ["Front Cover", "Inner Spread", "Lyrics", "Credits", "Back Tray"] },
  cassette: { id: "cassette", label: "Cassette J-Card", w: 864, h: 340, pageNames: ["J-Card: Front / Spine / Back"] },
  vinyl: { id: "vinyl", label: "Vinyl Insert", w: 600, h: 600, pageNames: ["Front", "Back", "Inner Sleeve A", "Inner Sleeve B"] },
};

const THEMES = [
  { id: "mono", name: "Monochrome", bg: "#f2f2f0", text: "#141414", accent: "#141414", texture: "none", locked: false },
  { id: "neon", name: "Neon Cyberpunk", bg: "#0a0014", text: "#ecebff", accent: "#ff2e88", texture: "grain", locked: true },
  { id: "analog", name: "Soft Analog", bg: "#efe6da", text: "#3a2f28", accent: "#c4744f", texture: "paper", locked: true },
  { id: "archival", name: "Faded Archival", bg: "#e9e2d0", text: "#54503f", accent: "#8a7a52", texture: "noise", locked: true },
  { id: "xerox", name: "Lo-fi Xerox", bg: "#f5f5f2", text: "#111111", accent: "#111111", texture: "xerox", locked: true },
];

const FONT_CHOICES = ["Inter", "Share Tech Mono", "Georgia", "Courier New", "Times New Roman", "Arial Black", "Verdana"];

const TIERS = {
  free: { label: "Free Starter", maxProjects: 1 },
  indie_artist: { label: "Indie Artist", maxProjects: Infinity },
  indie_label: { label: "Indie Label", maxProjects: Infinity },
  enterprise: { label: "Enterprise Label", maxProjects: Infinity },
};

function uid(prefix = "id") {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}

function textureDataUri(kind) {
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

function makeBlankPage(name) {
  return { id: uid("page"), name, blocks: [] };
}

function makeProject({ name, artist, formatId }) {
  const format = FORMATS[formatId];
  const now = Date.now();
  return {
    id: uid("proj"),
    name: name || "Untitled Release",
    artist: artist || "",
    formatId,
    metadata: {
      title: name || "", artist: artist || "", releaseDate: "", tracklist: "",
      contributors: "", label: "", catalogNumber: "", notes: "",
    },
    theme: { ...THEMES[0], fontHeadline: "Share Tech Mono", fontBody: "Inter" },
    pages: format.pageNames.map((n) => makeBlankPage(n)),
    createdAt: now,
    updatedAt: now,
  };
}

function makeTextBlock(theme) {
  return {
    id: uid("blk"), type: "text", x: 40, y: 40, w: 220, h: 90, z: 1, hidden: false,
    content: "New text block", fontFamily: theme?.fontBody || "Inter", fontSize: 18,
    fontWeight: "400", color: theme?.text || "#141414", align: "left",
  };
}
function makeImageBlock(src) {
  return { id: uid("blk"), type: "image", x: 40, y: 40, w: 220, h: 220, z: 1, hidden: false, src, opacity: 1, fit: "cover" };
}
function makeShapeBlock(shape) {
  return { id: uid("blk"), type: "shape", shape, x: 40, y: 40, w: 160, h: 100, z: 1, hidden: false, fill: "#141414", opacity: 1 };
}
function makeHotspotBlock() {
  return { id: uid("blk"), type: "hotspot", x: 40, y: 40, w: 130, h: 40, z: 1, hidden: false, label: "Hotspot", note: "Add a story note, translation, or annotation.", linkedAudioId: "", timestamp: 0 };
}
function makeAudioBlock(src, label) {
  return { id: uid("blk"), type: "audio", x: 40, y: 40, w: 200, h: 56, z: 1, hidden: false, src, label: label || "Track" };
}

/* ---------------------------------------------------------------------- */
/* Root component                                                          */
/* ---------------------------------------------------------------------- */

export default function BookletStudio() {
  const [loaded, setLoaded] = useState(false);
  const [projects, setProjects] = useState([]);
  const [tier, setTier] = useState("free");
  const [view, setView] = useState("dashboard"); // dashboard | editor
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [previewProjectId, setPreviewProjectId] = useState(null);
  const [saveFlash, setSaveFlash] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("booklet-studio-app");
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          setProjects(parsed.projects || []);
          setTier(parsed.tier || "free");
        }
      } catch (e) {
        /* nothing saved yet */
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    (async () => {
      try {
        await window.storage.set("booklet-studio-app", JSON.stringify({ projects, tier }));
        if (!cancelled) {
          setSaveFlash(true);
          setTimeout(() => !cancelled && setSaveFlash(false), 1200);
        }
      } catch (e) {
        console.error("Storage save failed", e);
      }
    })();
    return () => { cancelled = true; };
  }, [projects, tier, loaded]);

  const updateProject = useCallback((id, updater) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...updater(p), updatedAt: Date.now() } : p)));
  }, []);

  const currentProject = projects.find((p) => p.id === currentProjectId) || null;
  const previewProject = projects.find((p) => p.id === previewProjectId) || null;

  const handleCreateProject = (formatId, name, artist) => {
    const limit = TIERS[tier].maxProjects;
    if (projects.length >= limit) {
      setShowNewModal(false);
      setShowUpgradeModal(true);
      return;
    }
    const proj = makeProject({ name, artist, formatId });
    setProjects((prev) => [...prev, proj]);
    setCurrentProjectId(proj.id);
    setView("editor");
    setShowNewModal(false);
  };

  const handleDeleteProject = (id) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div style={rootStyle}>
      <GlobalStyle />
      {view === "dashboard" && (
        <Dashboard
          projects={projects}
          tier={tier}
          saveFlash={saveFlash}
          onOpen={(id) => { setCurrentProjectId(id); setView("editor"); }}
          onPreview={(id) => setPreviewProjectId(id)}
          onDelete={handleDeleteProject}
          onNew={() => {
            const limit = TIERS[tier].maxProjects;
            if (projects.length >= limit) setShowUpgradeModal(true);
            else setShowNewModal(true);
          }}
        />
      )}
      {view === "editor" && currentProject && (
        <Editor
          project={currentProject}
          tier={tier}
          saveFlash={saveFlash}
          onUpdate={(updater) => updateProject(currentProject.id, updater)}
          onBack={() => { setView("dashboard"); setCurrentProjectId(null); }}
          onPreview={() => setPreviewProjectId(currentProject.id)}
          onRequestUpgrade={() => setShowUpgradeModal(true)}
        />
      )}
      {showNewModal && (
        <NewProjectModal onClose={() => setShowNewModal(false)} onCreate={handleCreateProject} />
      )}
      {showUpgradeModal && (
        <UpgradeModal
          currentTier={tier}
          onClose={() => setShowUpgradeModal(false)}
          onSimulateUpgrade={(t) => { setTier(t); setShowUpgradeModal(false); }}
        />
      )}
      {previewProject && (
        <PreviewViewer project={previewProject} onClose={() => setPreviewProjectId(null)} />
      )}
    </div>
  );
}

const rootStyle = {
  minHeight: "100%",
  width: "100%",
  background: "var(--void-bg)",
  color: "var(--ash)",
  fontFamily: "var(--font-body)",
  position: "relative",
};

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Inter:wght@400;500;600;700&display=swap');
      :root {
        --void-bg: #0b0b10;
        --void-panel: #15151c;
        --void-panel-2: #1c1c25;
        --void-border: #2a2a35;
        --crt-amber: #ffb400;
        --signal-cyan: #4de3ff;
        --ash: #a3a3ad;
        --ash-bright: #e7e7ec;
        --paper: #f2ede3;
        --alert: #ff4d5e;
        --font-display: 'Share Tech Mono', monospace;
        --font-body: 'Inter', system-ui, sans-serif;
      }
      * { box-sizing: border-box; }
      button { font-family: inherit; cursor: pointer; }
      input, textarea, select { font-family: inherit; }
      .bs-scanlines::before {
        content: '';
        position: absolute; inset: 0; pointer-events: none;
        background: repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 2px);
        mix-blend-mode: overlay;
      }
      .bs-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
      .bs-scroll::-webkit-scrollbar-thumb { background: var(--void-border); border-radius: 4px; }
      .bs-scroll::-webkit-scrollbar-track { background: transparent; }
      @media print {
        body * { visibility: hidden; }
        .bs-print-root, .bs-print-root * { visibility: visible; }
        .bs-print-root { position: absolute; top: 0; left: 0; }
        .bs-print-page { page-break-after: always; }
      }
    `}</style>
  );
}

/* ---------------------------------------------------------------------- */
/* Dashboard                                                               */
/* ---------------------------------------------------------------------- */

function Dashboard({ projects, tier, saveFlash, onOpen, onPreview, onDelete, onNew }) {
  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 26 }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", color: "var(--crt-amber)", fontSize: 12, letterSpacing: 3 }}>BOOKLET STUDIO</div>
          <div style={{ fontSize: 22, color: "var(--ash-bright)", fontWeight: 600, marginTop: 4 }}>Your Releases</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <SaveIndicator show={saveFlash} />
          <TierBadge tier={tier} />
          <button onClick={onNew} style={primaryBtnStyle}>
            <Plus size={15} /> New Release
          </button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div style={{ border: "1px dashed var(--void-border)", borderRadius: 10, padding: "60px 30px", textAlign: "center", color: "var(--ash)" }}>
          <div style={{ fontFamily: "var(--font-display)", color: "var(--ash-bright)", fontSize: 15, marginBottom: 8 }}>NO RELEASES YET</div>
          <div style={{ fontSize: 13, marginBottom: 18 }}>Your first booklet is free, full creative flow, full export. Start with a blank canvas or a format template.</div>
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

function SaveIndicator({ show }) {
  return (
    <div style={{ fontFamily: "var(--font-display)", fontSize: 11, color: show ? "var(--crt-amber)" : "var(--void-border)", display: "flex", alignItems: "center", gap: 6, transition: "color .3s" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
      {show ? "SAVED" : "IDLE"}
    </div>
  );
}

function TierBadge({ tier }) {
  return (
    <div style={{ fontFamily: "var(--font-display)", fontSize: 11, letterSpacing: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--void-border)", color: "var(--signal-cyan)" }}>
      {TIERS[tier].label.toUpperCase()}
    </div>
  );
}

function ProjectCard({ project, onOpen, onPreview, onDelete }) {
  const format = FORMATS[project.formatId];
  const theme = project.theme;
  return (
    <div style={{ background: "var(--void-panel)", border: "1px solid var(--void-border)", borderRadius: 10, overflow: "hidden" }}>
      <div
        onClick={onOpen}
        style={{
          height: 130, cursor: "pointer", position: "relative",
          background: theme.bg, backgroundImage: textureDataUri(theme.texture),
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <div style={{ color: theme.text, fontFamily: theme.fontHeadline, fontSize: 13, opacity: 0.75, textAlign: "center", padding: 10 }}>
          {project.name}
        </div>
      </div>
      <div style={{ padding: "12px 14px" }}>
        <div style={{ color: "var(--ash-bright)", fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{project.name}</div>
        <div style={{ fontSize: 12, color: "var(--ash)", marginBottom: 10 }}>{project.artist || "No artist set"} · {format.label} · {project.pages.length} pages</div>
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
/* New Project Modal                                                       */
/* ---------------------------------------------------------------------- */

function NewProjectModal({ onClose, onCreate }) {
  const [formatId, setFormatId] = useState("blank");
  const [name, setName] = useState("");
  const [artist, setArtist] = useState("");

  return (
    <ModalShell onClose={onClose} title="New Release">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 18 }}>
        {Object.values(FORMATS).map((f) => (
          <button
            key={f.id}
            onClick={() => setFormatId(f.id)}
            style={{
              ...ghostBtnStyle, flexDirection: "column", alignItems: "flex-start", height: 66, padding: 10,
              border: formatId === f.id ? "1px solid var(--signal-cyan)" : "1px solid var(--void-border)",
              color: formatId === f.id ? "var(--signal-cyan)" : "var(--ash-bright)",
            }}
          >
            <div style={{ fontFamily: "var(--font-display)", fontSize: 12 }}>{f.label}</div>
            <div style={{ fontSize: 11, color: "var(--ash)" }}>{f.w} × {f.h} · {f.pageNames.length} pages</div>
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

/* ---------------------------------------------------------------------- */
/* Upgrade Modal                                                           */
/* ---------------------------------------------------------------------- */

function UpgradeModal({ currentTier, onClose, onSimulateUpgrade }) {
  const order = ["free", "indie_artist", "indie_label", "enterprise"];
  return (
    <ModalShell onClose={onClose} title="Unlock more of the studio">
      <div style={{ fontSize: 13, color: "var(--ash)", marginBottom: 18, lineHeight: 1.5 }}>
        Your first booklet is complete and yours to keep. Ready for the next release, more design tools, or a team workflow? Pick where you'd like to go.
        <div style={{ fontSize: 11, color: "var(--crt-amber)", marginTop: 8 }}>Demo note: this switches the local tier flag only — no real billing is wired up.</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {order.map((t) => (
          <button
            key={t}
            disabled={t === currentTier}
            onClick={() => onSimulateUpgrade(t)}
            style={{
              ...ghostBtnStyle, justifyContent: "space-between", padding: "12px 14px",
              opacity: t === currentTier ? 0.4 : 1,
              border: "1px solid var(--void-border)",
            }}
          >
            <span style={{ fontFamily: "var(--font-display)" }}>{TIERS[t].label}</span>
            <span style={{ fontSize: 11, color: "var(--signal-cyan)" }}>{t === currentTier ? "Current" : "Select"}</span>
          </button>
        ))}
      </div>
    </ModalShell>
  );
}

function ModalShell({ title, onClose, children }) {
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

function Editor({ project, tier, saveFlash, onUpdate, onBack, onPreview, onRequestUpgrade }) {
  const format = FORMATS[project.formatId];
  const [selectedPageId, setSelectedPageId] = useState(project.pages[0]?.id);
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [rightPanel, setRightPanel] = useState("properties"); // properties | theme | metadata
  const fileInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const pendingToolRef = useRef(null);
  const canvasWrapRef = useRef(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    if (!project.pages.find((pg) => pg.id === selectedPageId)) {
      setSelectedPageId(project.pages[0]?.id);
    }
  }, [project.pages, selectedPageId]);

  useEffect(() => {
    const compute = () => {
      const maxW = 560, maxH = 620;
      setScale(Math.min(maxW / format.w, maxH / format.h, 1));
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [format.w, format.h]);

  const page = project.pages.find((pg) => pg.id === selectedPageId) || project.pages[0];
  const selectedBlock = page?.blocks.find((b) => b.id === selectedBlockId) || null;

  const setPages = (updater) => {
    onUpdate((p) => ({ ...p, pages: updater(p.pages) }));
  };

  const setBlocksForPage = (pageId, updater) => {
    setPages((pages) => pages.map((pg) => (pg.id === pageId ? { ...pg, blocks: updater(pg.blocks) } : pg)));
  };

  const addBlock = (block) => {
    setBlocksForPage(page.id, (blocks) => [...blocks, { ...block, z: blocks.length + 1 }]);
    setSelectedBlockId(block.id);
  };

  const updateBlock = (blockId, patch) => {
    setBlocksForPage(page.id, (blocks) => blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)));
  };

  const deleteBlock = (blockId) => {
    setBlocksForPage(page.id, (blocks) => blocks.filter((b) => b.id !== blockId));
    if (selectedBlockId === blockId) setSelectedBlockId(null);
  };

  const moveBlockZ = (blockId, dir) => {
    setBlocksForPage(page.id, (blocks) => {
      const sorted = [...blocks].sort((a, b) => a.z - b.z);
      const idx = sorted.findIndex((b) => b.id === blockId);
      const swapIdx = dir === "up" ? idx + 1 : idx - 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return blocks;
      const a = sorted[idx], b = sorted[swapIdx];
      const az = a.z, bz = b.z;
      return blocks.map((blk) => {
        if (blk.id === a.id) return { ...blk, z: bz };
        if (blk.id === b.id) return { ...blk, z: az };
        return blk;
      });
    });
  };

  const handleToolClick = (tool) => {
    if (tool === "text") addBlock(makeTextBlock(project.theme));
    else if (tool === "rect") addBlock(makeShapeBlock("rect"));
    else if (tool === "circle") addBlock(makeShapeBlock("circle"));
    else if (tool === "hotspot") addBlock(makeHotspotBlock());
    else if (tool === "image") { pendingToolRef.current = "image"; fileInputRef.current?.click(); }
    else if (tool === "audio") { pendingToolRef.current = "audio"; audioInputRef.current?.click(); }
  };

  const handleFileChosen = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      alert("This prototype stores media inline; please use a file under 4MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (pendingToolRef.current === "image") addBlock(makeImageBlock(reader.result));
      else if (pendingToolRef.current === "audio") addBlock(makeAudioBlock(reader.result, file.name.replace(/\.[^.]+$/, "")));
    };
    reader.readAsDataURL(file);
  };

  const addPage = (duplicate) => {
    const newPage = duplicate
      ? { ...page, id: uid("page"), name: page.name + " copy", blocks: page.blocks.map((b) => ({ ...b, id: uid("blk") })) }
      : makeBlankPage("New page");
    setPages((pages) => {
      const idx = pages.findIndex((pg) => pg.id === page.id);
      const next = [...pages];
      next.splice(idx + 1, 0, newPage);
      return next;
    });
    setSelectedPageId(newPage.id);
  };

  const deletePage = (pageId) => {
    if (project.pages.length <= 1) return;
    setPages((pages) => pages.filter((pg) => pg.id !== pageId));
  };

  const reorderPage = (pageId, dir) => {
    setPages((pages) => {
      const idx = pages.findIndex((pg) => pg.id === pageId);
      const swap = dir === "left" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= pages.length) return pages;
      const next = [...pages];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  const applyTheme = (themeId) => {
    const t = THEMES.find((th) => th.id === themeId);
    if (t.locked && tier === "free") { onRequestUpgrade(); return; }
    onUpdate((p) => ({ ...p, theme: { ...p.theme, ...t } }));
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 700 }}>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChosen} />
      <input ref={audioInputRef} type="file" accept="audio/*" style={{ display: "none" }} onChange={handleFileChosen} />

      {/* Transport bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", borderBottom: "1px solid var(--void-border)", background: "var(--void-panel)" }}>
        <button onClick={onBack} style={iconBtnStyle} title="Back to dashboard"><Home size={16} /></button>
        <div style={{ width: 1, height: 22, background: "var(--void-border)", margin: "0 6px" }} />
        <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--ash-bright)" }}>{project.name}</div>
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
          <TierBadge tier={tier} />
          <button onClick={onPreview} style={ghostBtnStyle}><Eye size={14} /> Preview</button>
          <ExportMenu onExportJSON={exportJSON} />
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Left: pages + layers */}
        <div style={{ width: 220, borderRight: "1px solid var(--void-border)", display: "flex", flexDirection: "column", background: "var(--void-panel)" }}>
          <PanelHeader label="Pages" />
          <div className="bs-scroll" style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", maxHeight: "40%" }}>
            {project.pages.map((pg, i) => (
              <div
                key={pg.id}
                onClick={() => setSelectedPageId(pg.id)}
                style={{
                  border: pg.id === selectedPageId ? "1px solid var(--signal-cyan)" : "1px solid var(--void-border)",
                  borderRadius: 6, padding: "8px 10px", cursor: "pointer", fontSize: 12,
                  color: pg.id === selectedPageId ? "var(--signal-cyan)" : "var(--ash)",
                  display: "flex", flexDirection: "column", gap: 4,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{i + 1}. {pg.name}</span>
                  {project.pages.length > 1 && (
                    <span onClick={(e) => { e.stopPropagation(); deletePage(pg.id); }} style={{ color: "var(--alert)" }}><X size={12} /></span>
                  )}
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
              <div
                key={b.id}
                onClick={() => setSelectedBlockId(b.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "6px 8px", borderRadius: 6,
                  background: b.id === selectedBlockId ? "var(--void-panel-2)" : "transparent",
                  color: b.hidden ? "var(--void-border)" : "var(--ash)", cursor: "pointer",
                }}
              >
                <BlockTypeIcon type={b.type} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {b.type === "text" ? b.content.slice(0, 16) : b.type}
                </span>
                <span onClick={(e) => { e.stopPropagation(); updateBlock(b.id, { hidden: !b.hidden }); }}>
                  {b.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                </span>
                <span onClick={(e) => { e.stopPropagation(); moveBlockZ(b.id, "up"); }}><ChevronUp size={12} /></span>
                <span onClick={(e) => { e.stopPropagation(); moveBlockZ(b.id, "down"); }}><ChevronDown size={12} /></span>
                <span onClick={(e) => { e.stopPropagation(); deleteBlock(b.id); }} style={{ color: "var(--alert)" }}><Trash2 size={12} /></span>
              </div>
            ))}
            {(!page || page.blocks.length === 0) && <div style={{ fontSize: 11, color: "var(--void-border)" }}>No blocks on this page yet.</div>}
          </div>
        </div>

        {/* Center: canvas */}
        <div ref={canvasWrapRef} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto", background: "#050507" }}>
          {page && (
            <div
              onPointerDown={() => setSelectedBlockId(null)}
              style={{
                width: format.w * scale, height: format.h * scale, position: "relative",
                background: project.theme.bg, backgroundImage: textureDataUri(project.theme.texture),
                boxShadow: "0 20px 60px rgba(0,0,0,0.6)", overflow: "hidden",
              }}
            >
              {page.blocks.filter((b) => !b.hidden).map((b) => (
                <CanvasBlock
                  key={b.id}
                  block={b}
                  scale={scale}
                  selected={b.id === selectedBlockId}
                  onSelect={() => setSelectedBlockId(b.id)}
                  onChange={(patch) => updateBlock(b.id, patch)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: properties / theme / metadata */}
        <div style={{ width: 260, borderLeft: "1px solid var(--void-border)", background: "var(--void-panel)", overflowY: "auto" }} className="bs-scroll">
          {rightPanel === "theme" && <ThemePanel project={project} tier={tier} onApplyTheme={applyTheme} onUpdate={onUpdate} onRequestUpgrade={onRequestUpgrade} />}
          {rightPanel === "metadata" && <MetadataPanel project={project} onUpdate={onUpdate} />}
          {rightPanel === "properties" && (
            selectedBlock
              ? <PropertiesPanel block={selectedBlock} page={page} onChange={(patch) => updateBlock(selectedBlock.id, patch)} />
              : <div style={{ padding: 16, fontSize: 12, color: "var(--void-border)" }}>Select a block to edit its properties, or use Theme / Details above.</div>
          )}
          {(rightPanel === "theme" || rightPanel === "metadata") && (
            <div style={{ padding: 10 }}>
              <button onClick={() => setRightPanel("properties")} style={{ ...ghostBtnStyle, width: "100%" }}>Back to properties</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PanelHeader({ label, icon: Icon }) {
  return (
    <div style={{ padding: "10px 12px", fontFamily: "var(--font-display)", fontSize: 11, letterSpacing: 1, color: "var(--ash)", borderBottom: "1px solid var(--void-border)", display: "flex", alignItems: "center", gap: 6 }}>
      {Icon && <Icon size={12} />} {label.toUpperCase()}
    </div>
  );
}

function BlockTypeIcon({ type }) {
  const map = { text: Type, image: ImageIcon, audio: Music, shape: Square, hotspot: Link2 };
  const Icon = map[type] || Square;
  return <Icon size={12} />;
}

function ToolButton({ icon: Icon, label, onClick, active }) {
  return (
    <button onClick={onClick} title={label} style={{ ...iconBtnStyle, background: active ? "var(--void-panel-2)" : "transparent", color: active ? "var(--signal-cyan)" : "var(--ash)" }}>
      <Icon size={16} />
    </button>
  );
}

function ExportMenu({ onExportJSON }) {
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

function CanvasBlock({ block, scale, selected, onSelect, onChange }) {
  const handlePointerDown = (e) => {
    e.stopPropagation();
    onSelect();
    const startX = e.clientX, startY = e.clientY;
    const startBX = block.x, startBY = block.y;
    const onMove = (ev) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      onChange({ x: startBX + dx, y: startBY + dy });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleResizeDown = (e) => {
    e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    const startW = block.w, startH = block.h;
    const onMove = (ev) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      onChange({ w: Math.max(30, startW + dx), h: Math.max(20, startH + dy) });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      style={{
        position: "absolute", left: block.x * scale, top: block.y * scale, width: block.w * scale, height: block.h * scale,
        zIndex: block.z, outline: selected ? "2px solid var(--signal-cyan)" : "1px dashed transparent", cursor: "move",
      }}
    >
      <BlockContent block={block} scale={scale} />
      {selected && (
        <div onPointerDown={handleResizeDown} style={{ position: "absolute", right: -6, bottom: -6, width: 12, height: 12, background: "var(--signal-cyan)", cursor: "nwse-resize", borderRadius: 2 }} />
      )}
    </div>
  );
}

function BlockContent({ block, scale }) {
  if (block.type === "text") {
    return (
      <div style={{
        width: "100%", height: "100%", fontFamily: block.fontFamily, fontSize: block.fontSize * scale,
        fontWeight: block.fontWeight, color: block.color, textAlign: block.align, overflow: "hidden", padding: 4,
        whiteSpace: "pre-wrap", pointerEvents: "none",
      }}>
        {block.content}
      </div>
    );
  }
  if (block.type === "image") {
    return <img src={block.src} draggable={false} style={{ width: "100%", height: "100%", objectFit: block.fit, opacity: block.opacity, pointerEvents: "none" }} />;
  }
  if (block.type === "shape") {
    return <div style={{ width: "100%", height: "100%", background: block.fill, opacity: block.opacity, borderRadius: block.shape === "circle" ? "50%" : 0 }} />;
  }
  if (block.type === "hotspot") {
    return (
      <div style={{ width: "100%", height: "100%", border: "1px dashed var(--signal-cyan)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 * scale + 8, color: "var(--signal-cyan)", background: "rgba(77,227,255,0.08)", pointerEvents: "none" }}>
        {block.label}
      </div>
    );
  }
  if (block.type === "audio") {
    return (
      <div style={{ width: "100%", height: "100%", border: "1px solid var(--void-border)", borderRadius: 8, display: "flex", alignItems: "center", gap: 8, padding: "0 10px", background: "var(--void-panel-2)", pointerEvents: "none" }}>
        <Music size={14} color="var(--crt-amber)" />
        <span style={{ fontSize: 11, color: "var(--ash)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{block.label}</span>
      </div>
    );
  }
  return null;
}

/* ---------------------------------------------------------------------- */
/* Properties / Theme / Metadata panels                                    */
/* ---------------------------------------------------------------------- */

function PropertiesPanel({ block, page, onChange }) {
  return (
    <div style={{ padding: 14 }}>
      <PanelHeader label={`${block.type} properties`} />
      <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {block.type === "text" && (
          <>
            <label style={labelStyle}>Content</label>
            <textarea style={{ ...inputStyle, minHeight: 70 }} value={block.content} onChange={(e) => onChange({ content: e.target.value })} />
            <label style={labelStyle}>Font</label>
            <select style={inputStyle} value={block.fontFamily} onChange={(e) => onChange({ fontFamily: e.target.value })}>
              {FONT_CHOICES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <label style={labelStyle}>Size</label>
            <input type="range" min="10" max="72" value={block.fontSize} onChange={(e) => onChange({ fontSize: Number(e.target.value) })} />
            <label style={labelStyle}>Weight</label>
            <select style={inputStyle} value={block.fontWeight} onChange={(e) => onChange({ fontWeight: e.target.value })}>
              <option value="300">Light</option><option value="400">Regular</option><option value="600">Semibold</option><option value="700">Bold</option>
            </select>
            <label style={labelStyle}>Align</label>
            <select style={inputStyle} value={block.align} onChange={(e) => onChange({ align: e.target.value })}>
              <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option><option value="justify">Justify</option>
            </select>
            <label style={labelStyle}>Color</label>
            <input type="color" value={block.color} onChange={(e) => onChange({ color: e.target.value })} style={{ width: "100%", height: 32 }} />
          </>
        )}
        {block.type === "image" && (
          <>
            <label style={labelStyle}>Opacity</label>
            <input type="range" min="0" max="1" step="0.05" value={block.opacity} onChange={(e) => onChange({ opacity: Number(e.target.value) })} />
            <label style={labelStyle}>Fit</label>
            <select style={inputStyle} value={block.fit} onChange={(e) => onChange({ fit: e.target.value })}>
              <option value="cover">Cover</option><option value="contain">Contain</option><option value="fill">Fill</option>
            </select>
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
              {(page?.blocks || []).filter((b) => b.type === "audio").map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
            <label style={labelStyle}>Timestamp (seconds)</label>
            <input type="number" min="0" style={inputStyle} value={block.timestamp} onChange={(e) => onChange({ timestamp: Number(e.target.value) })} />
          </>
        )}
        {block.type === "audio" && (
          <div style={{ fontSize: 12, color: "var(--ash)" }}>Link a hotspot to this track to let readers jump to a lyric timestamp in Preview.</div>
        )}
      </div>
    </div>
  );
}

function ThemePanel({ project, tier, onApplyTheme, onUpdate, onRequestUpgrade }) {
  return (
    <div style={{ padding: 14 }}>
      <PanelHeader label="Theme presets" icon={Palette} />
      <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {THEMES.map((t) => {
          const isLocked = t.locked && tier === "free";
          return (
            <button
              key={t.id}
              onClick={() => onApplyTheme(t.id)}
              style={{
                ...ghostBtnStyle, justifyContent: "space-between", padding: "10px 12px",
                border: project.theme.id === t.id ? "1px solid var(--signal-cyan)" : "1px solid var(--void-border)",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 16, height: 16, borderRadius: 4, background: t.bg, border: "1px solid var(--void-border)" }} />
                {t.name}
              </span>
              {isLocked && <Lock size={12} color="var(--crt-amber)" />}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 18 }}>
        <PanelHeader label="Typography" />
        <div style={{ paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={labelStyle}>Headline font</label>
          <select style={inputStyle} value={project.theme.fontHeadline} onChange={(e) => onUpdate((p) => ({ ...p, theme: { ...p.theme, fontHeadline: e.target.value } }))}>
            {FONT_CHOICES.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <label style={labelStyle}>Body font</label>
          <select style={inputStyle} value={project.theme.fontBody} onChange={(e) => onUpdate((p) => ({ ...p, theme: { ...p.theme, fontBody: e.target.value } }))}>
            {FONT_CHOICES.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

function MetadataPanel({ project, onUpdate }) {
  const set = (key, value) => onUpdate((p) => ({ ...p, metadata: { ...p.metadata, [key]: value } }));
  const fields = [
    ["title", "Title"], ["artist", "Artist"], ["releaseDate", "Release date"], ["label", "Label / imprint"],
    ["catalogNumber", "Catalog number"], ["contributors", "Contributors"], ["tracklist", "Tracklist"], ["notes", "Notes"],
  ];
  return (
    <div style={{ padding: 14 }}>
      <PanelHeader label="Release details" icon={Settings} />
      <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {fields.map(([key, label]) => (
          <div key={key}>
            <label style={labelStyle}>{label}</label>
            {["tracklist", "notes", "contributors"].includes(key) ? (
              <textarea style={{ ...inputStyle, minHeight: 56 }} value={project.metadata[key]} onChange={(e) => set(key, e.target.value)} />
            ) : (
              <input style={inputStyle} value={project.metadata[key]} onChange={(e) => set(key, e.target.value)} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Preview viewer                                                          */
/* ---------------------------------------------------------------------- */

function PreviewViewer({ project, onClose }) {
  const format = FORMATS[project.formatId];
  const [pageIndex, setPageIndex] = useState(0);
  const [activeNote, setActiveNote] = useState(null);
  const audioRefs = useRef({});
  const [playingId, setPlayingId] = useState(null);

  const page = project.pages[pageIndex];

  const go = useCallback((dir) => {
    setActiveNote(null);
    setPageIndex((i) => Math.max(0, Math.min(project.pages.length - 1, i + dir)));
  }, [project.pages.length]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  const scale = Math.min(700 / format.w, 760 / format.h);

  const handleHotspotClick = (block) => {
    if (block.linkedAudioId) {
      const el = audioRefs.current[block.linkedAudioId];
      if (el) {
        el.currentTime = block.timestamp || 0;
        el.play();
        setPlayingId(block.linkedAudioId);
      }
    }
    if (block.note) setActiveNote(block.note);
    else setActiveNote(null);
  };

  const toggleAudio = (block) => {
    const el = audioRefs.current[block.id];
    if (!el) return;
    if (playingId === block.id) { el.pause(); setPlayingId(null); }
    else { el.play(); setPlayingId(block.id); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 200, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px" }}>
        <div style={{ fontFamily: "var(--font-display)", color: "var(--ash-bright)", fontSize: 13 }}>{project.name} — Preview</div>
        <button onClick={onClose} style={iconBtnStyle}><X size={18} color="var(--ash-bright)" /></button>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <button onClick={() => go(-1)} disabled={pageIndex === 0} style={{ ...iconBtnStyle, position: "absolute", left: 20, opacity: pageIndex === 0 ? 0.3 : 1 }}><ArrowLeft size={22} color="var(--ash-bright)" /></button>
        <div
          key={page.id}
          style={{
            width: format.w * scale, height: format.h * scale, position: "relative",
            background: project.theme.bg, backgroundImage: textureDataUri(project.theme.texture),
            boxShadow: "0 30px 90px rgba(0,0,0,0.7)", animation: "bsFade .35s ease",
          }}
        >
          <style>{`@keyframes bsFade { from { opacity: 0; transform: scale(0.98);} to { opacity:1; transform: scale(1);} }`}</style>
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
                <div
                  key={b.id}
                  onClick={() => handleHotspotClick(b)}
                  style={{
                    position: "absolute", left: b.x * scale, top: b.y * scale, width: b.w * scale, height: b.h * scale,
                    border: "1px solid transparent", borderRadius: 6, cursor: "pointer",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.border = "1px solid var(--signal-cyan)")}
                  onMouseLeave={(e) => (e.currentTarget.style.border = "1px solid transparent")}
                  title={b.label}
                />
              );
            }
            return (
              <div key={b.id} style={{ position: "absolute", left: b.x * scale, top: b.y * scale, width: b.w * scale, height: b.h * scale, zIndex: b.z }}>
                <BlockContent block={b} scale={scale} />
              </div>
            );
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
      <div style={{ textAlign: "center", padding: "10px 0", fontSize: 11, color: "var(--ash)", fontFamily: "var(--font-display)" }}>
        PAGE {pageIndex + 1} / {project.pages.length} — use ← → keys, click hotspots for notes
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Shared style tokens                                                     */
/* ---------------------------------------------------------------------- */

const primaryBtnStyle = {
  display: "flex", alignItems: "center", gap: 6, background: "var(--crt-amber)", color: "#141414",
  border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 600,
};
const ghostBtnStyle = {
  display: "flex", alignItems: "center", gap: 6, background: "transparent", color: "var(--ash-bright)",
  border: "1px solid var(--void-border)", borderRadius: 6, padding: "8px 12px", fontSize: 12,
};
const iconBtnStyle = {
  display: "flex", alignItems: "center", justifyContent: "center", background: "transparent",
  border: "none", borderRadius: 6, padding: 8, color: "var(--ash)",
};
const inputStyle = {
  width: "100%", background: "var(--void-panel-2)", border: "1px solid var(--void-border)", borderRadius: 6,
  padding: "8px 10px", fontSize: 12, color: "var(--ash-bright)", outline: "none",
};
const labelStyle = { fontSize: 11, color: "var(--ash)", textTransform: "uppercase", letterSpacing: 0.5 };
const menuItemStyle = {
  display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 12px", background: "transparent",
  border: "none", color: "var(--ash-bright)", fontSize: 12, textAlign: "left",
};
