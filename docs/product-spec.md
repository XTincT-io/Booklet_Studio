# Product Spec: [Working Title] — Interactive Digital Booklet Studio

**Doc type:** PRD-style product spec
**Status:** Draft v1
**Owner:** XTincT-io

---

## 1. Problem & Vision

Physical music releases came with a tactile, narrative object: the CD booklet, the cassette J-card, the vinyl inner sleeve. Digital releases lost that entirely — a stream link has no lore, no liner notes, no credits page, no easter eggs. Musicians and labels have no purpose-built tool to recreate that experience for the web.

**Vision:** A drag-and-drop studio where any artist or label can assemble an interactive "digital booklet" — lyrics, liner notes, art, video, hidden pages — using format-aware templates (CD/cassette/vinyl), then publish it as a linkable, embeddable web object or export it as PDF/image assets.

**Primary value prop:** Give every digital release the packaging depth of a physical one, with zero design skill required to get a good first result, and a deep toolset for those who want to push further.

---

## 2. Target Users

| Segment | Need |
|---|---|
| Solo/indie artist (self-releasing) | Wants their single/EP/album to feel like a "real" release online. Little to no design skill or budget. |
| Serious indie artist / small act with a designer | Wants multiple releases packaged consistently, higher fidelity, brand control. |
| Indie label / collective | Manages several artists' releases, needs shared branding, roles, and a release calendar. |
| Enterprise label | Needs scale, security, compliance, and integration into existing catalog/CMS/fan-app systems. |

---

## 3. Core Concept & Primary Flow

Users start from:
- **Blank booklet**
- **Format template** (CD, cassette J-card, vinyl insert)
- **Themed preset** (e.g., neon cyberpunk, faded archival, lo-fi xerox)

Primary flow:
1. Create a project/release
2. Upload assets (MP4, MP3, images, documents)
3. Add lyrics/liner notes
4. Design and arrange booklet pages
5. Customize fonts, colors, textures
6. Add interactivity
7. Preview
8. Export or publish

This is the backbone of the Booklet Editor's step-based navigation (see §7).

---

## 4. Content Inputs & Parsing

**Drag-and-drop support:**
- MP4 (video clips, visualizers)
- MP3 (tracks, snippets)
- Images (covers, photography, art)
- Text documents: TXT, DOC/DOCX, PDF (lyrics, credits)

**Parsing behavior:**
- Auto-extract text from uploaded lyric/liner note files (DOCX/PDF/TXT parsers run server-side; user gets an editable text block pre-populated with extracted content, never a locked/read-only import).
- Extraction failures (e.g., scanned/image-only PDF) fall back to an empty editable block with a clear "couldn't auto-extract — paste manually" notice rather than a silent failure.

**Text editor:**
- Structured labeling: verse / chorus / bridge / outro / ad-lib
- Dedicated sections: credits, thank-yous, production notes, lore/world-building notes
- Section templates can be reused across a label's roster (Indie Label+ tier)

**Release metadata fields:**
Title, artist, release date, tracklist (ordered, with per-track duration/features), contributors (name + role), label/imprint, catalog number, general notes.

---

## 5. Booklet Layout & Page System

The booklet is a **multi-page canvas of spreads**: front cover, back cover, inner pages, lyric pages, credits pages, and secret/bonus pages (unlockable in Preview mode — see §8).

**Format-specific presets & aspect ratios:**
- CD booklet (standard jewel-case insert dimensions, front + tray card)
- Cassette J-card (front, spine, back — accounting for the fold)
- Vinyl inner sleeve / insert (12" and 7" variants)
- A free-form "web-native" canvas with no physical constraint, for artists who don't care about print fidelity

**Placeable elements per page:**
- Text blocks
- Image blocks
- Video frames
- Audio play buttons
- Shapes, stickers, icons
- Interactive hotspots (click/hover regions)

**Page-level features:**
- Background image or texture
- Grid and snapping
- Duplicate / reorder pages (drag in a filmstrip page-tray)
- Safe zone and bleed indicators, toggle-able, relevant only if the user later exports for print

---

## 6. Visual Styling & Theming

**Typography**
- Curated font pairing presets (headline + body + mono)
- Manual font selection for advanced users
- Controls: size, weight, leading, tracking, alignment, justification

**Color**
- Theme presets: monochrome, neon cyberpunk, soft analog, faded archival, lo-fi xerox, and room for more over time
- Full custom pickers: hex/RGBA, gradients
- Palette-based theming: apply globally (whole booklet) or per-page (override)

**Backgrounds & textures**
- User-uploaded background images
- Built-in texture library: paper grain, worn plastic, tape hiss noise, xerox noise, canvas, brushed metal, etc.
- Texture overlay controls: opacity + blend mode, stackable over solid color or gradient

---

## 7. Creative Canvas & Tools

A simplified Photoshop/Canva-style canvas, windowed with side panels, aiming for "powerful but not intimidating."

**Core tools:** Select/Move · Pan/Zoom · Crop & frame · Transform (scale/rotate/flip) · Text · Shape (rect/circle/line/polygon) · Pen/Path · Eraser/Mask · Align & distribute

**Layer system:**
- Visibility toggle, lock, group/ungroup
- Opacity + blend modes (normal, multiply, screen, overlay, etc.)
- Naming and reordering

**Complexity management:**
- Advanced options live in collapsible panels, hidden by default
- Toolbar is context-aware: changes based on the selected element type (text vs image vs shape vs hotspot)

---

## 8. Interactivity & Preview

**Interaction types:**
- Hover states on images/text/buttons (color shift, glow, underline, micro-animation)
- Clickable lyric segments that can:
  - Jump to a timestamp in a linked audio track
  - Open a pop-up with story notes, translation, or annotation
- Clickable images → full-screen or modal detail view
- Page-turn animations between spreads
- Optional subtle parallax on backgrounds during transitions

**Preview Viewer (dedicated mode):**
- Full-screen booklet playback
- Navigation via click, scroll, or arrow keys
- Audio playback tied to pages or specific hotspots
- Tooltips/hints marking interactive areas so viewers know where to click

---

## 9. App Structure — Modules

| Module | Purpose |
|---|---|
| **Project Dashboard** | List of booklets/releases, status, quick actions |
| **Asset Manager** | Upload, tag, and manage media + documents |
| **Booklet Editor** | Canvas/page builder — layout + tools |
| **Theme Designer** | Fonts, colors, textures, presets |
| **Interactivity Engine** | Hotspots, audio/video links, interaction states |
| **Preview Viewer** | Interactive booklet playback |
| **Export/Publish** | Web viewer, PDF, image assets, embeds |
| **Collaboration** (Indie Label+) | Shared access, comments, roles |

---

## 10. Tier System & Business Model

**Rule:** every new user's first booklet is free — full creative flow, full export — before any upgrade prompt appears.

### Free Starter
*Target: first-time users, solo artists trying the tool.*
- 1 free booklet project, full creative flow
- Upload MP4/MP3/images/documents for that one project
- Core fonts, basic themes, basic textures
- Interactive preview
- Export: one standard web booklet + one basic PDF/image export
- After first booklet: gentle upgrade prompts appear only when the user tries to start a second project or reaches for an advanced/premium feature — framed as "unlock more," never a hard wall

### Indie Artist
*Target: independent musicians, small self-releasing acts.*
- Multiple booklet projects (active + archived)
- More storage, higher-resolution media
- Full advanced canvas tools + layer controls
- Expanded font library + premium pairings
- Expanded texture library + custom style-preset saving
- More export options: high-quality PDF, higher-res images, embeddable web viewer, social snippet exports
- Positioning: the primary "creator" tier

### Indie Label
*Target: small labels, collectives, teams managing multiple artists.*
- Multi-artist project grouping (by artist/imprint)
- Role-based access: admin, designer, viewer, collaborator
- Shared asset libraries (logos, templates, brand kits)
- Label-level theme presets, reusable across releases
- Collaboration: comments, review/approval flow, activity log
- Release scheduling with status (draft → in review → final → live)
- Analytics: views/engagement per web booklet, per release
- Positioning: control center for a small roster

### Enterprise Label
*Target: large labels/orgs with big catalogs, complex teams.*
- Many artists, many releases, one org
- SSO, advanced permissioning
- Detailed audit logs, compliance-friendly event tracking
- Dedicated support/onboarding
- Optional white-label / custom-branded instance (own domain, own skin)
- API access (integrate with CMS, fan apps, other internal systems)
- Optional private hosting, enhanced security/compliance
- Positioning: full-scale booklet infrastructure

### Upgrade Triggers (all tiers below Enterprise)
- Starting a second project (Free Starter → Indie Artist)
- Hitting a storage limit
- Attempting a feature reserved for a higher tier
- All prompts message what's being *unlocked*, not what's being *blocked*

---

## 11. Feature Matrix

| Feature | Free Starter | Indie Artist | Indie Label | Enterprise Label |
|---|:---:|:---:|:---:|:---:|
| Booklet projects | 1 | Multiple | Multiple, multi-artist | Unlimited, org-wide |
| Upload MP4/MP3/image/doc | ✓ | ✓ | ✓ | ✓ |
| Core fonts & basic themes | ✓ | ✓ | ✓ | ✓ |
| Premium font pairings | – | ✓ | ✓ | ✓ |
| Basic textures | ✓ | ✓ | ✓ | ✓ |
| Expanded texture library | – | ✓ | ✓ | ✓ |
| Custom saved style presets | – | ✓ | ✓ | ✓ |
| Advanced canvas tools & layers | Limited | Full | Full | Full |
| Interactive preview | ✓ | ✓ | ✓ | ✓ |
| Standard web export | 1 | ✓ | ✓ | ✓ |
| Basic PDF/image export | 1 | ✓ | ✓ | ✓ |
| High-res PDF/image export | – | ✓ | ✓ | ✓ |
| Embeddable web viewer | – | ✓ | ✓ | ✓ |
| Social snippet exports | – | ✓ | ✓ | ✓ |
| Multi-artist grouping | – | – | ✓ | ✓ |
| Role-based access | – | – | ✓ | ✓ |
| Shared asset/brand libraries | – | – | ✓ | ✓ |
| Label-level theme presets | – | – | ✓ | ✓ |
| Collaboration (comments/approval) | – | – | ✓ | ✓ |
| Release scheduling & status | – | – | ✓ | ✓ |
| Analytics | – | – | ✓ | ✓ |
| SSO | – | – | – | ✓ |
| Audit logs / compliance tracking | – | – | – | ✓ |
| White-label / custom domain | – | – | – | ✓ |
| API access | – | – | – | ✓ |
| Private hosting | – | – | – | Optional |
| Dedicated support | – | – | – | ✓ |

---

## 12. Detailed User Flows

### 12.1 New user creating their first free booklet
1. Lands on marketing page → "Start your first booklet free"
2. Signs up (email or OAuth) → immediately dropped into Project Dashboard, empty state with a big "Create your booklet" CTA
3. Chooses starting point: blank / format template (CD, cassette, vinyl) / themed preset
4. Enters release metadata (title, artist, tracklist, etc.) — can skip and fill later
5. Drags in cover art, one audio file, lyric doc → system auto-extracts lyric text into an editable block
6. Lands in Booklet Editor with a pre-built page structure (cover, lyric page, credits page) based on format chosen
7. Adjusts theme via Theme Designer (core fonts/basic themes only — no upgrade nag yet)
8. Adds one or two hotspots (e.g., click lyric line → note pop-up) via Interactivity Engine
9. Hits Preview → full interactive playback, confirms it feels complete and polished
10. Exports: gets one web link + one PDF/image export
11. Tries to start a *second* project → sees the first upgrade prompt, framed as "Ready for your next release? Unlock unlimited projects with Indie Artist."

### 12.2 Indie artist managing multiple releases
1. Upgrades to Indie Artist tier from the prompt above (or proactively from billing page)
2. Project Dashboard now shows active + archived projects; duplicates a prior booklet as a starting template for a new EP
3. Uses full advanced canvas (layers, blend modes, pen tool) to build a more elaborate multi-spread booklet
4. Saves a custom color/texture combo as a personal style preset to reuse across future releases for brand consistency
5. Builds out richer interactivity: video frame with hover glow, clickable art that opens a modal with photo essay
6. Exports high-res PDF for a limited physical zine tie-in, plus an embeddable web viewer link to drop on their own site and social bios

### 12.3 Indie label managing multiple artists and collaborating
1. Label admin upgrades org to Indie Label tier, creates the org workspace
2. Invites team members with roles: designer, viewer, collaborator
3. Sets up shared asset library (label logo, imprint typography, brand color kit) once, available across all artist projects
4. Creates label-level theme presets so every release shares a visual identity while allowing per-artist page content to differ
5. Projects are grouped by artist/imprint in the dashboard; each has a status (draft/in review/final/live) and a scheduled release date
6. Designer builds a booklet, admin/A&R leaves comments on specific pages, designer revises, admin approves → status flips to "final"
7. On release day, status flips to "live"; label checks the analytics panel a week later for views/engagement per release, comparing performance across the roster

### 12.4 Enterprise label using advanced features
1. Org IT sets up SSO for the whole org; roles/permissions mirror existing internal org chart
2. Legal/compliance reviews audit logs to confirm who edited/approved what and when, satisfying internal compliance requirements
3. Dev team uses API access to auto-generate booklet drafts from the label's existing catalog/CMS metadata whenever a new release is scheduled internally
4. Marketing requests a white-labeled instance on a custom domain (e.g., booklets.labelname.com) matching the label's own brand skin
5. A regional sub-label operates semi-independently within the org's permission structure, with its own roster grouping but shared brand kit governance
6. Dedicated support contact is looped in for a launch-week issue, resolved with priority SLA

---

## 13. Implementation-Oriented Architecture Outline (Next.js scaffold target)

### Front-end modules
- `app/dashboard` — Project Dashboard (list, filters, status badges, quick actions)
- `app/assets` — Asset Manager (upload UI, tagging, media grid, storage usage meter)
- `app/editor/[projectId]` — Booklet Editor
  - Canvas engine: recommend `konva`/`react-konva` or `fabric.js` for layer-based 2D canvas manipulation (drag, transform, layers, blend modes)
  - Page-tray component (filmstrip of spreads, drag-to-reorder)
  - Context-aware right-side toolbar keyed to selected element type
- `app/theme` — Theme Designer (font pairing picker, color/gradient picker, texture library browser)
- `app/interactivity` — Hotspot editor overlay on canvas; state machine for hover/click/reveal behaviors
- `app/preview/[projectId]` — Preview Viewer (isolated full-screen route, own audio context, keyboard nav)
- `app/export` — Export/Publish flow (format selection, job status polling)
- `app/settings/billing` — Tier management, upgrade prompts, Stripe customer portal
- `app/org/[orgId]` — Label/Enterprise workspace (roster grouping, roles, shared libraries, scheduling calendar, analytics dashboard)

### Back-end services (fits existing `platform-core`)
- **Auth & orgs:** users, orgs, roles/permissions (RBAC), SSO integration point for Enterprise
- **Asset service:** upload handling (signed URLs to object storage, e.g., S3-compatible), transcoding/thumbnailing queue via BullMQ, virus/type validation
- **Document parsing service:** DOCX/PDF/TXT text extraction (queued job — large PDFs/DOCX shouldn't block the request thread); returns structured text + fallback-on-failure handling
- **Project/booklet data model:** projects → spreads/pages → elements (polymorphic: text/image/video/audio/shape/hotspot) with position/transform/layer/z-index, versioned for undo/collab
- **Interactivity/state engine:** stores hotspot definitions and linked actions (jump-to-timestamp, open-modal, show-annotation) as data, rendered by both Editor and Preview Viewer from the same schema
- **Export service:** queued export jobs (BullMQ) — web viewer bundle generation, PDF rendering (headless render of canvas to print-safe layout), image asset export; job status polling endpoint
- **Billing:** Stripe webhooks, tier/entitlement checks gating project count, storage quota, feature flags per tier
- **Collaboration:** comments/activity log tables scoped per project; approval workflow as a simple status state machine (draft/in review/final/live)
- **Analytics:** lightweight event ingestion (page view, hotspot interaction, audio play) for the Preview Viewer, aggregated per release for the Indie Label+ dashboard
- **Audit logging (Enterprise):** append-only event log distinct from analytics, covering permission/content changes for compliance

### Infrastructure notes
- Shared primitives such as Prisma/Postgres, a job queue (e.g., BullMQ), and Stripe webhooks can back auth, billing, and export jobs without standing up parallel infrastructure
- "Neon cyberpunk" and "lo-fi xerox" are a natural first pair of theme presets to ship, given they can share a texture/typography asset pipeline

---

## 14. Open Questions
- Hosting model for published web booklets: subdomain per release (e.g., `name.bookletstudio.app`) vs. path-based, and how that interacts with white-labeling at Enterprise tier
- Whether physical print-ready export (true bleed/safe-zone CMYK output) is in scope for v1 or a later add-on, given it's called out as "if printing is ever needed"
- Audio licensing/storage limits — MP3 uploads at scale have real storage cost implications that should shape Free/Indie Artist storage caps
- Whether "secret/bonus pages" need a distinct gating mechanic (password, easter-egg click sequence) or are simply pages placed late in page order
