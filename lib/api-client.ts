import type {
  OrgSummary,
  ProjectFull,
  ProjectSummary,
  PageData,
  ThemeData,
  MetadataFields,
  MemberSummary,
  AuditLogEntry,
  ProjectAnalytics,
  ParseJobStatus,
  ExportJobStatus,
  ExportTypeKey,
  SsoConfigSummary,
} from "./types";

class ApiError extends Error {
  status?: number;
  code?: string;
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string; code?: string });
    const err = new ApiError(body.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = body.code;
    throw err;
  }

  return res.json() as Promise<T>;
}

export const api = {
  listOrgs: () => apiFetch<{ orgs: OrgSummary[] }>("/api/orgs"),

  createOrg: (name: string) => apiFetch<{ org: OrgSummary }>("/api/orgs", { method: "POST", body: JSON.stringify({ name }) }),

  listProjects: (orgId: string) => apiFetch<{ projects: ProjectSummary[] }>(`/api/projects?orgId=${encodeURIComponent(orgId)}`),

  getProject: (id: string) => apiFetch<{ project: ProjectFull }>(`/api/projects/${id}`),

  createProject: (data: { orgId: string; name: string; artist?: string; formatId: string }) =>
    apiFetch<{ project: ProjectFull }>("/api/projects", { method: "POST", body: JSON.stringify(data) }),

  updateProject: (
    id: string,
    patch: Partial<{ name: string; artist: string; metadata: MetadataFields; theme: ThemeData; status: string }>
  ) => apiFetch<{ project: ProjectSummary }>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),

  deleteProject: (id: string) => apiFetch<{ ok: true }>(`/api/projects/${id}`, { method: "DELETE" }),

  createPage: (projectId: string, data: { name: string; blocks: unknown[] }) =>
    apiFetch<{ page: PageData }>(`/api/projects/${projectId}/pages`, { method: "POST", body: JSON.stringify(data) }),

  updatePage: (projectId: string, pageId: string, patch: Partial<{ name: string; order: number; blocks: unknown[] }>) =>
    apiFetch<{ page: PageData }>(`/api/projects/${projectId}/pages/${pageId}`, { method: "PATCH", body: JSON.stringify(patch) }),

  deletePage: (projectId: string, pageId: string) =>
    apiFetch<{ ok: true }>(`/api/projects/${projectId}/pages/${pageId}`, { method: "DELETE" }),

  getUploadUrl: (orgId: string, filename: string, contentType: string) =>
    apiFetch<{ uploadUrl: string; publicUrl: string; key: string }>("/api/assets/upload-url", {
      method: "POST",
      body: JSON.stringify({ orgId, filename, contentType }),
    }),

  createAssetRecord: (data: { orgId: string; key: string; url: string; type: string; sizeBytes: number }) =>
    apiFetch<{ asset: unknown }>("/api/assets", { method: "POST", body: JSON.stringify(data) }),

  createCheckout: (orgId: string, tier: string) =>
    apiFetch<{ url: string }>("/api/billing/checkout", { method: "POST", body: JSON.stringify({ orgId, tier }) }),

  devSetTier: (orgId: string, tier: string) =>
    apiFetch<{ org: unknown }>("/api/dev/set-tier", { method: "POST", body: JSON.stringify({ orgId, tier }) }),

  createBillingPortalSession: (orgId: string) =>
    apiFetch<{ url: string }>("/api/billing/portal", { method: "POST", body: JSON.stringify({ orgId }) }),

  // --- Standard web export (hosted public link, every tier) ---
  getPublishStatus: (projectId: string) =>
    apiFetch<{ publicEnabled: boolean; publicUrl: string | null }>(`/api/projects/${projectId}/publish`),
  setPublishStatus: (projectId: string, enabled: boolean) =>
    apiFetch<{ publicEnabled: boolean; publicUrl: string | null }>(`/api/projects/${projectId}/publish`, {
      method: "POST",
      body: JSON.stringify({ enabled }),
    }),

  // --- Team / roster ---
  listMembers: (orgId: string) => apiFetch<{ members: MemberSummary[] }>(`/api/orgs/${orgId}/members`),
  addOrUpdateMember: (orgId: string, email: string, role: string) =>
    apiFetch<{ membership: unknown }>(`/api/orgs/${orgId}/members`, { method: "POST", body: JSON.stringify({ email, role }) }),
  removeMember: (orgId: string, membershipId: string) =>
    apiFetch<{ ok: true }>(`/api/orgs/${orgId}/members`, { method: "DELETE", body: JSON.stringify({ membershipId }) }),

  // --- Audit log ---
  listAuditLog: (orgId: string) => apiFetch<{ logs: AuditLogEntry[] }>(`/api/orgs/${orgId}/audit-log`),

  // --- Analytics ---
  getOrgAnalytics: (orgId: string) => apiFetch<{ projects: ProjectAnalytics[] }>(`/api/orgs/${orgId}/analytics`),

  // --- Document parsing (lyrics/liner-note import) ---
  createParseJob: (projectId: string, data: { key: string; filename: string; mimeType: string }) =>
    apiFetch<{ job: ParseJobStatus }>(`/api/projects/${projectId}/parse-jobs`, { method: "POST", body: JSON.stringify(data) }),
  getParseJob: (jobId: string) => apiFetch<{ job: ParseJobStatus }>(`/api/parse-jobs/${jobId}`),

  // --- Server-rendered export ---
  createExportJob: (projectId: string, type: ExportTypeKey) =>
    apiFetch<{ job: ExportJobStatus }>(`/api/projects/${projectId}/export-jobs`, { method: "POST", body: JSON.stringify({ type }) }),
  getExportJob: (jobId: string) => apiFetch<{ job: ExportJobStatus }>(`/api/export-jobs/${jobId}`),

  // --- SSO (Enterprise) ---
  getSsoConfig: (orgId: string) => apiFetch<{ config: SsoConfigSummary | null; loginUrl: string | null }>(`/api/orgs/${orgId}/sso`),
  saveSsoConfig: (orgId: string, data: { issuer: string; clientId: string; clientSecret: string; defaultRole: string }) =>
    apiFetch<{ config: SsoConfigSummary }>(`/api/orgs/${orgId}/sso`, { method: "PUT", body: JSON.stringify(data) }),
  deleteSsoConfig: (orgId: string) => apiFetch<{ ok: true }>(`/api/orgs/${orgId}/sso`, { method: "DELETE" }),
};

/** Fire-and-forget analytics ping from the Preview Viewer — never throws, never blocks the UI. */
export function trackEvent(projectId: string, pageId: string | null, type: "view" | "hotspot_open" | "audio_play"): void {
  try {
    fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, pageId, type }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // analytics should never break the viewer
  }
}

/** Same as uploadFileToOrg, but also returns the storage key — needed by the lyric-import flow to enqueue a parse job. */
export async function uploadFileToOrgWithKey(orgId: string, file: File): Promise<{ publicUrl: string; key: string }> {
  const { uploadUrl, publicUrl, key } = await api.getUploadUrl(orgId, file.name, file.type);

  const putRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!putRes.ok) throw new Error("Upload to storage failed");

  await api.createAssetRecord({ orgId, key, url: publicUrl, type: file.type, sizeBytes: file.size });
  return { publicUrl, key };
}

/** Uploads a file directly to the configured bucket via a presigned URL, then records it. */
export async function uploadFileToOrg(orgId: string, file: File): Promise<string> {
  const { uploadUrl, publicUrl, key } = await api.getUploadUrl(orgId, file.name, file.type);

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!putRes.ok) throw new Error("Upload to storage failed");

  await api.createAssetRecord({ orgId, key, url: publicUrl, type: file.type, sizeBytes: file.size });
  return publicUrl;
}

export { ApiError };
