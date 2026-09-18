import type { BlockData, PageData, ProjectFull } from "@/lib/types";

/**
 * Server-side (no React) HTML rendering of a booklet, mirroring the canvas rules in
 * components/BookletApp.tsx (CanvasBlock / BlockContent / textureDataUri) closely
 * enough that a rendered export looks like what the artist designed. Shared by:
 *  - lib/export/pdf.ts (renders this HTML headlessly and prints to PDF)
 *  - lib/export/web-bundle.ts (ships this HTML as a static, interactive viewer)
 */

const FORMAT_DIMENSIONS: Record<string, { w: number; h: number }> = {
  blank: { w: 800, h: 1000 },
  cd: { w: 592, h: 592 },
  cassette: { w: 864, h: 340 },
  vinyl: { w: 600, h: 600 },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function textureBackgroundImage(kind: string): string {
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

function renderBlock(block: BlockData, forWebViewer: boolean): string {
  const pos = `position:absolute; left:${block.x}px; top:${block.y}px; width:${block.w}px; height:${block.h}px; z-index:${block.z};`;
  if (block.hidden) return "";

  switch (block.type) {
    case "text":
      return `<div style="${pos} font-family:'${escapeHtml(block.fontFamily)}',sans-serif; font-size:${block.fontSize}px; font-weight:${block.fontWeight}; color:${block.color}; text-align:${block.align}; white-space:pre-wrap; overflow:hidden;">${escapeHtml(block.content)}</div>`;

    case "image":
      return `<div style="${pos} overflow:hidden;"><img src="${escapeHtml(block.src)}" style="width:100%; height:100%; object-fit:${block.fit}; opacity:${block.opacity};" /></div>`;

    case "shape":
      return `<div style="${pos} background:${block.fill}; opacity:${block.opacity}; border-radius:${block.shape === "circle" ? "50%" : "0"};"></div>`;

    case "hotspot":
      if (!forWebViewer) return ""; // hotspots are interactive-only; static PDF/image export skips them
      return `<div class="bs-hotspot" data-note="${escapeHtml(block.note)}" data-linked-audio="${escapeHtml(block.linkedAudioId)}" data-timestamp="${block.timestamp}" style="${pos} cursor:pointer;" title="${escapeHtml(block.label)}"></div>`;

    case "audio":
      if (!forWebViewer) return ""; // audio can't render into a static PDF/image page
      return `<div style="${pos}"><button class="bs-audio-toggle" data-audio-id="${block.id}" style="width:100%; height:100%; border:1px solid #2a2a35; border-radius:8px; background:#1c1c25; color:#e7e7ec; font-size:12px;">▶ ${escapeHtml(block.label)}</button><audio id="audio-${block.id}" src="${escapeHtml(block.src)}" preload="none"></audio></div>`;

    default:
      return "";
  }
}

function renderPage(page: PageData, project: ProjectFull, dims: { w: number; h: number }, forWebViewer: boolean, pageIndex: number): string {
  const blocksHtml = [...page.blocks].sort((a, b) => a.z - b.z).map((b) => renderBlock(b, forWebViewer)).join("\n");
  const pageClass = forWebViewer ? "bs-page" : "bs-print-page";
  return `<section class="${pageClass}" data-page-index="${pageIndex}" data-page-id="${page.id}" style="position:relative; width:${dims.w}px; height:${dims.h}px; background:${project.theme.bg}; background-image:${textureBackgroundImage(project.theme.texture)}; overflow:hidden;">
    ${blocksHtml}
  </section>`;
}

/** Renders the whole booklet as a print-ready HTML document (one page per <section>, page-break between each) for headless PDF rendering. */
export function renderPrintHtml(project: ProjectFull): string {
  const dims = FORMAT_DIMENSIONS[project.formatId] ?? FORMAT_DIMENSIONS.blank;
  const pagesHtml = project.pages
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((page, i) => renderPage(page, project, dims, false, i))
    .join("\n");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<title>${escapeHtml(project.name)}</title>
<style>
  @page { size: ${dims.w}px ${dims.h}px; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; }
  .bs-print-page { page-break-after: always; }
  .bs-print-page:last-child { page-break-after: avoid; }
</style>
</head><body>${pagesHtml}</body></html>`;
}

/** Renders the whole booklet as a self-contained, interactive HTML viewer (hotspots + audio work) for the web-viewer bundle export. */
export function renderWebViewerHtml(project: ProjectFull): string {
  const dims = FORMAT_DIMENSIONS[project.formatId] ?? FORMAT_DIMENSIONS.blank;
  const pagesHtml = project.pages
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((page, i) => renderPage(page, project, dims, true, i))
    .join("\n");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(project.name)}${project.artist ? " — " + escapeHtml(project.artist) : ""}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #050507; font-family: 'Inter', sans-serif; display: flex; flex-direction: column; align-items: center; min-height: 100vh; padding: 24px 0; }
  .bs-page { display: none; box-shadow: 0 30px 90px rgba(0,0,0,0.7); }
  .bs-page.bs-active { display: block; }
  .bs-nav { display: flex; gap: 16px; align-items: center; margin-top: 16px; color: #a3a3ad; font-size: 13px; }
  .bs-nav button { background: #1c1c25; color: #e7e7ec; border: 1px solid #2a2a35; border-radius: 6px; padding: 8px 14px; cursor: pointer; }
  .bs-note { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: #15151c; border: 1px solid #4de3ff; border-radius: 8px; padding: 12px 16px; max-width: 420px; font-size: 13px; color: #e7e7ec; display: none; }
</style>
</head><body>
${pagesHtml}
<div class="bs-nav">
  <button id="bs-prev">← Prev</button>
  <span id="bs-counter"></span>
  <button id="bs-next">Next →</button>
</div>
<div class="bs-note" id="bs-note"></div>
<script>
(function () {
  var pages = Array.prototype.slice.call(document.querySelectorAll(".bs-page"));
  var idx = 0;
  var noteEl = document.getElementById("bs-note");
  var counterEl = document.getElementById("bs-counter");
  var trackBase = ${JSON.stringify(process.env.ANALYTICS_TRACK_URL || "")};
  var projectId = ${JSON.stringify(project.id)};

  function track(type, pageId) {
    if (!trackBase) return;
    try {
      fetch(trackBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: projectId, pageId: pageId, type: type }),
        keepalive: true,
      }).catch(function () {});
    } catch (e) {}
  }

  function show(i) {
    pages.forEach(function (p, pi) { p.classList.toggle("bs-active", pi === i); });
    counterEl.textContent = (i + 1) + " / " + pages.length;
    noteEl.style.display = "none";
    track("view", pages[i].dataset.pageId);
  }

  document.getElementById("bs-prev").addEventListener("click", function () { idx = Math.max(0, idx - 1); show(idx); });
  document.getElementById("bs-next").addEventListener("click", function () { idx = Math.min(pages.length - 1, idx + 1); show(idx); });
  window.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") { idx = Math.max(0, idx - 1); show(idx); }
    if (e.key === "ArrowRight") { idx = Math.min(pages.length - 1, idx + 1); show(idx); }
  });

  document.querySelectorAll(".bs-hotspot").forEach(function (el) {
    el.addEventListener("click", function () {
      var note = el.dataset.note;
      var linkedAudioId = el.dataset.linkedAudio;
      var timestamp = parseFloat(el.dataset.timestamp || "0");
      if (linkedAudioId) {
        var audioEl = document.getElementById("audio-" + linkedAudioId);
        if (audioEl) { audioEl.currentTime = timestamp; audioEl.play(); }
      }
      if (note) { noteEl.textContent = note; noteEl.style.display = "block"; }
      track("hotspot_open", el.closest(".bs-page") ? el.closest(".bs-page").dataset.pageId : null);
    });
  });

  document.querySelectorAll(".bs-audio-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var audioEl = document.getElementById("audio-" + btn.dataset.audioId);
      if (!audioEl) return;
      if (audioEl.paused) { audioEl.play(); track("audio_play", btn.closest(".bs-page") ? btn.closest(".bs-page").dataset.pageId : null); }
      else audioEl.pause();
    });
  });

  show(0);
})();
</script>
</body></html>`;
}
