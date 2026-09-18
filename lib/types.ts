export type TierKey = "FREE" | "INDIE_ARTIST" | "INDIE_LABEL" | "ENTERPRISE";
export type RoleKey = "ADMIN" | "DESIGNER" | "COLLABORATOR" | "VIEWER";

export interface OrgSummary {
  id: string;
  name: string;
  tier: TierKey;
  role: RoleKey;
}

export interface ThemeData {
  id: string;
  bg: string;
  text: string;
  accent: string;
  texture: string;
  fontHeadline: string;
  fontBody: string;
}

export interface BaseBlock {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  hidden: boolean;
}

export interface TextBlock extends BaseBlock {
  type: "text";
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  color: string;
  align: string;
}

export interface ImageBlock extends BaseBlock {
  type: "image";
  src: string;
  opacity: number;
  fit: string;
}

export interface ShapeBlock extends BaseBlock {
  type: "shape";
  shape: "rect" | "circle";
  fill: string;
  opacity: number;
}

export interface HotspotBlock extends BaseBlock {
  type: "hotspot";
  label: string;
  note: string;
  linkedAudioId: string;
  timestamp: number;
}

export interface AudioBlock extends BaseBlock {
  type: "audio";
  src: string;
  label: string;
}

export type BlockData = TextBlock | ImageBlock | ShapeBlock | HotspotBlock | AudioBlock;

export interface PageData {
  id: string;
  name: string;
  order: number;
  blocks: BlockData[];
}

export interface MetadataFields {
  title: string;
  artist: string;
  releaseDate: string;
  tracklist: string;
  contributors: string;
  label: string;
  catalogNumber: string;
  notes: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  artist?: string | null;
  formatId: string;
  status: string;
  theme: ThemeData;
  metadata: MetadataFields;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFull extends ProjectSummary {
  pages: PageData[];
}

export interface MemberSummary {
  id: string; // membership id
  role: RoleKey;
  user: { id: string; email: string; name: string | null };
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actorId: string;
  targetId: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export interface ProjectAnalytics {
  projectId: string;
  projectName: string;
  views: number;
  hotspotOpens: number;
  audioPlays: number;
  last30DaysViews: { date: string; count: number }[];
}

export type JobStatusKey = "QUEUED" | "PROCESSING" | "DONE" | "FAILED";

export interface ParseJobStatus {
  id: string;
  status: JobStatusKey;
  resultText: string | null;
  errorMessage: string | null;
}

export type ExportTypeKey = "PDF" | "WEB_BUNDLE" | "IMAGES";

export interface ExportJobStatus {
  id: string;
  type: ExportTypeKey;
  status: JobStatusKey;
  resultUrl: string | null;
  errorMessage: string | null;
}

export interface SsoConfigSummary {
  issuer: string;
  clientId: string;
  defaultRole: RoleKey;
  hasClientSecret: true;
}
