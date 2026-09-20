"use client";

import React, { useEffect, useState } from "react";
import { Home, UserPlus, Trash2, ShieldCheck, BarChart3, KeyRound } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import type { OrgSummary, MemberSummary, AuditLogEntry, ProjectAnalytics, SsoConfigSummary, RoleKey } from "@/lib/types";
import { rootStyle, primaryBtnStyle, ghostBtnStyle, iconBtnStyle, inputStyle, labelStyle, menuItemStyle } from "./BookletApp";

type Tab = "roster" | "audit" | "analytics" | "sso";

const TIER_TAB_REQUIREMENT: Record<Tab, string | null> = {
  roster: "roles",
  analytics: "analytics",
  audit: "audit_log",
  sso: "sso",
};

const TAB_LABELS: Record<Tab, string> = { roster: "Roster", analytics: "Analytics", audit: "Audit Log", sso: "SSO" };
const TAB_ICONS: Record<Tab, React.ElementType> = { roster: UserPlus, analytics: BarChart3, audit: ShieldCheck, sso: KeyRound };

export function OrgWorkspace({ org, onBack, onRequestUpgrade }: { org: OrgSummary; onBack: () => void; onRequestUpgrade: () => void }) {
  const [tab, setTab] = useState<Tab>("roster");

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 26 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={iconBtnStyle} title="Back to dashboard"><Home size={16} /></button>
          <div>
            <div style={{ fontFamily: "var(--font-display)", color: "var(--crt-amber)", fontSize: 12, letterSpacing: 3 }}>BOOKLET STUDIO</div>
            <div style={{ fontSize: 22, color: "var(--ash-bright)", fontWeight: 600, marginTop: 4 }}>{org.name} — Team</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24, borderBottom: "1px solid var(--void-border)", paddingBottom: 12 }}>
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => {
          const Icon = TAB_ICONS[t];
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{ ...ghostBtnStyle, borderColor: tab === t ? "var(--crt-amber)" : "var(--void-border)", color: tab === t ? "var(--crt-amber)" : "var(--ash-bright)" }}
            >
              <Icon size={14} /> {TAB_LABELS[t]}
            </button>
          );
        })}
      </div>

      {tab === "roster" && <RosterPanel org={org} onRequestUpgrade={onRequestUpgrade} />}
      {tab === "analytics" && <AnalyticsPanel org={org} onRequestUpgrade={onRequestUpgrade} />}
      {tab === "audit" && <AuditLogPanel org={org} onRequestUpgrade={onRequestUpgrade} />}
      {tab === "sso" && <SsoPanel org={org} onRequestUpgrade={onRequestUpgrade} />}

      {org.role === "ADMIN" && <DangerZonePanel org={org} onBack={onBack} />}
    </div>
  );
}

function DangerZonePanel({ org, onBack }: { org: OrgSummary; onBack: () => void }) {
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.deleteOrg(org.id, confirmName);
      onBack();
      window.location.reload(); // simplest way to refresh the org list after deletion
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete this organization.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid var(--void-border)" }}>
      <div style={{ fontFamily: "var(--font-display)", color: "var(--alert)", fontSize: 13, marginBottom: 8 }}>DANGER ZONE</div>
      {!expanded ? (
        <button onClick={() => setExpanded(true)} style={{ ...ghostBtnStyle, borderColor: "var(--alert)", color: "var(--alert)" }}>
          Delete this organization
        </button>
      ) : (
        <div style={{ maxWidth: 420 }}>
          <p style={{ fontSize: 12, color: "var(--ash)", marginBottom: 12, lineHeight: 1.5 }}>
            Permanently deletes <strong>{org.name}</strong> and every project, asset, and export job in it.
            Only works if you're the only member — remove or reassign other teammates first. Type the
            organization's name to confirm.
          </p>
          {error && <div style={{ fontSize: 12, color: "var(--alert)", marginBottom: 10 }}>{error}</div>}
          <input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={org.name}
            style={{ ...inputStyle, width: "100%", marginBottom: 10 }}
          />
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={handleDelete}
              disabled={busy || confirmName !== org.name}
              style={{ ...primaryBtnStyle, background: "var(--alert)", opacity: confirmName !== org.name ? 0.5 : 1 }}
            >
              {busy ? "Deleting…" : "Permanently delete"}
            </button>
            <button onClick={() => { setExpanded(false); setConfirmName(""); setError(null); }} style={ghostBtnStyle}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TierGate({ org, feature, onRequestUpgrade, children }: { org: OrgSummary; feature: string; onRequestUpgrade: () => void; children: React.ReactNode }) {
  const gated = TIER_GATE_FEATURES[feature] ? !TIER_GATE_FEATURES[feature].includes(org.tier) : false;
  if (gated) {
    return (
      <div style={{ border: "1px dashed var(--void-border)", borderRadius: 10, padding: "50px 30px", textAlign: "center" }}>
        <div style={{ fontFamily: "var(--font-display)", color: "var(--ash-bright)", fontSize: 15, marginBottom: 8 }}>
          {TAB_LABELS[feature as Tab]?.toUpperCase() || feature.toUpperCase()} IS LOCKED
        </div>
        <p style={{ color: "var(--ash)", fontSize: 13, marginBottom: 18 }}>Upgrade your plan to unlock this for {org.name}.</p>
        <button onClick={onRequestUpgrade} style={primaryBtnStyle}>See plans</button>
      </div>
    );
  }
  return <>{children}</>;
}

// Mirrors lib/entitlements.ts's feature matrix so the UI can gate without an extra round trip;
// the API independently re-checks every one of these server-side.
const TIER_GATE_FEATURES: Record<string, OrgSummary["tier"][]> = {
  roles: ["INDIE_LABEL", "ENTERPRISE"],
  analytics: ["INDIE_LABEL", "ENTERPRISE"],
  audit_log: ["ENTERPRISE"],
  sso: ["ENTERPRISE"],
};

/* ---------------------------------------------------------------------- */
/* Roster                                                                  */
/* ---------------------------------------------------------------------- */

const ROLE_OPTIONS: RoleKey[] = ["ADMIN", "DESIGNER", "VIEWER"];

function RosterPanel({ org, onRequestUpgrade }: { org: OrgSummary; onRequestUpgrade: () => void }) {
  const [members, setMembers] = useState<MemberSummary[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleKey>("DESIGNER");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const { members } = await api.listMembers(org.id);
      setMembers(members);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the roster.");
    }
  };

  useEffect(() => { load(); }, [org.id]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.addOrUpdateMember(org.id, email, role);
      setEmail("");
      await load();
    } catch (e) {
      if (e instanceof ApiError && e.code === "TIER_LIMIT") onRequestUpgrade();
      else setError(e instanceof Error ? e.message : "Couldn't add that member.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (membershipId: string) => {
    if (!members) return;
    const prev = members;
    setMembers(members.filter((m) => m.id !== membershipId));
    try {
      await api.removeMember(org.id, membershipId);
    } catch (e) {
      setMembers(prev);
      setError(e instanceof Error ? e.message : "Couldn't remove that member.");
    }
  };

  return (
    <TierGate org={org} feature="roles" onRequestUpgrade={onRequestUpgrade}>
      <form onSubmit={handleAdd} style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center" }}>
        <input style={{ ...inputStyle, flex: 1 }} type="email" placeholder="teammate@label.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <select style={{ ...inputStyle, width: 140 }} value={role} onChange={(e) => setRole(e.target.value as RoleKey)}>
          {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <button type="submit" style={primaryBtnStyle} disabled={busy}><UserPlus size={14} /> Invite</button>
      </form>
      {error && <div style={{ color: "var(--alert)", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <div style={{ border: "1px solid var(--void-border)", borderRadius: 10, overflow: "hidden" }}>
        {members === null ? (
          <div style={{ padding: 20, color: "var(--ash)", fontSize: 13 }}>Loading roster…</div>
        ) : members.length === 0 ? (
          <div style={{ padding: 20, color: "var(--ash)", fontSize: 13 }}>No teammates yet — invite one above.</div>
        ) : (
          members.map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--void-border)" }}>
              <div>
                <div style={{ color: "var(--ash-bright)", fontSize: 13 }}>{m.user.name || m.user.email}</div>
                <div style={{ color: "var(--ash)", fontSize: 11 }}>{m.user.email}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ ...labelStyle, background: "var(--void-panel-2)", padding: "4px 8px", borderRadius: 4 }}>{m.role}</span>
                <button onClick={() => handleRemove(m.id)} style={iconBtnStyle} title="Remove"><Trash2 size={14} color="var(--alert)" /></button>
              </div>
            </div>
          ))
        )}
      </div>
    </TierGate>
  );
}

/* ---------------------------------------------------------------------- */
/* Analytics                                                               */
/* ---------------------------------------------------------------------- */

function MiniBarChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 48 }}>
      {data.map((d) => (
        <div key={d.date} title={`${d.date}: ${d.count}`} style={{ width: 6, height: Math.max(2, (d.count / max) * 48), background: "var(--signal-cyan)", borderRadius: 1 }} />
      ))}
    </div>
  );
}

function AnalyticsPanel({ org, onRequestUpgrade }: { org: OrgSummary; onRequestUpgrade: () => void }) {
  const [projects, setProjects] = useState<ProjectAnalytics[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getOrgAnalytics(org.id)
      .then((r) => setProjects(r.projects))
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load analytics."));
  }, [org.id]);

  return (
    <TierGate org={org} feature="analytics" onRequestUpgrade={onRequestUpgrade}>
      {error && <div style={{ color: "var(--alert)", fontSize: 13, marginBottom: 12 }}>{error}</div>}
      {projects === null ? (
        <div style={{ color: "var(--ash)", fontSize: 13 }}>Loading analytics…</div>
      ) : projects.length === 0 ? (
        <div style={{ color: "var(--ash)", fontSize: 13 }}>No releases yet — analytics will appear once fans start viewing a booklet.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          {projects.map((p) => (
            <div key={p.projectId} style={{ border: "1px solid var(--void-border)", borderRadius: 10, padding: 16 }}>
              <div style={{ color: "var(--ash-bright)", fontSize: 14, fontWeight: 600, marginBottom: 10 }}>{p.projectName}</div>
              <div style={{ display: "flex", gap: 18, marginBottom: 12 }}>
                <Stat label="Views" value={p.views} />
                <Stat label="Hotspot opens" value={p.hotspotOpens} />
                <Stat label="Audio plays" value={p.audioPlays} />
              </div>
              <div style={labelStyle}>Views, last 30 days</div>
              <MiniBarChart data={p.last30DaysViews} />
            </div>
          ))}
        </div>
      )}
    </TierGate>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ color: "var(--crt-amber)", fontSize: 18, fontWeight: 700, fontFamily: "var(--font-display)" }}>{value}</div>
      <div style={labelStyle}>{label}</div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Audit Log                                                               */
/* ---------------------------------------------------------------------- */

function AuditLogPanel({ org, onRequestUpgrade }: { org: OrgSummary; onRequestUpgrade: () => void }) {
  const [logs, setLogs] = useState<AuditLogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listAuditLog(org.id)
      .then((r) => setLogs(r.logs))
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load the audit log."));
  }, [org.id]);

  return (
    <TierGate org={org} feature="audit_log" onRequestUpgrade={onRequestUpgrade}>
      {error && <div style={{ color: "var(--alert)", fontSize: 13, marginBottom: 12 }}>{error}</div>}
      <div style={{ border: "1px solid var(--void-border)", borderRadius: 10, overflow: "hidden" }}>
        {logs === null ? (
          <div style={{ padding: 20, color: "var(--ash)", fontSize: 13 }}>Loading audit log…</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 20, color: "var(--ash)", fontSize: 13 }}>No activity recorded yet.</div>
        ) : (
          logs.map((entry) => (
            <div key={entry.id} style={{ padding: "10px 16px", borderBottom: "1px solid var(--void-border)", fontSize: 12 }}>
              <span style={{ color: "var(--signal-cyan)" }}>{entry.action}</span>{" "}
              <span style={{ color: "var(--ash)" }}>· {new Date(entry.createdAt).toLocaleString()}</span>
              {entry.meta && <div style={{ color: "var(--ash)", marginTop: 2 }}>{JSON.stringify(entry.meta)}</div>}
            </div>
          ))
        )}
      </div>
    </TierGate>
  );
}

/* ---------------------------------------------------------------------- */
/* SSO                                                                     */
/* ---------------------------------------------------------------------- */

function SsoPanel({ org, onRequestUpgrade }: { org: OrgSummary; onRequestUpgrade: () => void }) {
  const [config, setConfig] = useState<SsoConfigSummary | null>(null);
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [issuer, setIssuer] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [defaultRole, setDefaultRole] = useState<RoleKey>("VIEWER");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getSsoConfig(org.id)
      .then((r) => {
        setConfig(r.config);
        setLoginUrl(r.loginUrl);
        if (r.config) { setIssuer(r.config.issuer); setClientId(r.config.clientId); setDefaultRole(r.config.defaultRole); }
        setLoaded(true);
      })
      .catch((e) => { setError(e instanceof Error ? e.message : "Couldn't load SSO settings."); setLoaded(true); });
  }, [org.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { config } = await api.saveSsoConfig(org.id, { issuer, clientId, clientSecret, defaultRole });
      setConfig(config);
      setClientSecret("");
      const { loginUrl } = await api.getSsoConfig(org.id);
      setLoginUrl(loginUrl);
    } catch (e) {
      if (e instanceof ApiError && e.code === "TIER_LIMIT") onRequestUpgrade();
      else setError(e instanceof Error ? e.message : "Couldn't save SSO settings.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    try {
      await api.deleteSsoConfig(org.id);
      setConfig(null);
      setLoginUrl(null);
      setIssuer(""); setClientId(""); setClientSecret("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove SSO.");
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return <TierGate org={org} feature="sso" onRequestUpgrade={onRequestUpgrade}><div style={{ color: "var(--ash)", fontSize: 13 }}>Loading…</div></TierGate>;

  return (
    <TierGate org={org} feature="sso" onRequestUpgrade={onRequestUpgrade}>
      <p style={{ color: "var(--ash)", fontSize: 13, marginBottom: 16, maxWidth: 560 }}>
        Connect an OIDC identity provider (Okta, Azure AD, Google Workspace, etc.) so your team signs in with company
        credentials. New SSO sign-ins are provisioned automatically with the default role below.
      </p>
      {error && <div style={{ color: "var(--alert)", fontSize: 13, marginBottom: 12 }}>{error}</div>}
      {loginUrl && (
        <div style={{ ...menuItemStyle, background: "var(--void-panel-2)", borderRadius: 6, marginBottom: 16, cursor: "default" }}>
          Team login link: <code style={{ color: "var(--signal-cyan)" }}>{loginUrl}</code>
        </div>
      )}
      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 420 }}>
        <label style={labelStyle}>Issuer URL</label>
        <input style={inputStyle} placeholder="https://your-idp.example.com" value={issuer} onChange={(e) => setIssuer(e.target.value)} required />
        <label style={labelStyle}>Client ID</label>
        <input style={inputStyle} value={clientId} onChange={(e) => setClientId(e.target.value)} required />
        <label style={labelStyle}>Client secret {config && "(leave blank to keep current)"}</label>
        <input style={inputStyle} type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} required={!config} />
        <label style={labelStyle}>Default role for new SSO sign-ins</label>
        <select style={inputStyle} value={defaultRole} onChange={(e) => setDefaultRole(e.target.value as RoleKey)}>
          {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
          <button type="submit" style={primaryBtnStyle} disabled={busy}>{config ? "Update SSO" : "Enable SSO"}</button>
          {config && <button type="button" onClick={handleRemove} style={ghostBtnStyle} disabled={busy}>Remove SSO</button>}
        </div>
      </form>
    </TierGate>
  );
}
