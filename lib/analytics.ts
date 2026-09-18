import { db } from "./db";

/**
 * Lightweight, anonymous event ingestion for the Preview Viewer (page view, hotspot
 * interaction, audio play), aggregated per release for the Indie Label+ analytics
 * dashboard. No PII is recorded — just project/page ids and an event type.
 */
export type AnalyticsEventType = "view" | "hotspot_open" | "audio_play";

const VALID_EVENT_TYPES: AnalyticsEventType[] = ["view", "hotspot_open", "audio_play"];

export function isValidAnalyticsEventType(value: unknown): value is AnalyticsEventType {
  return typeof value === "string" && (VALID_EVENT_TYPES as string[]).includes(value);
}

export async function trackEvent(params: { projectId: string; pageId?: string | null; type: AnalyticsEventType }): Promise<void> {
  await db.analyticsEvent.create({
    data: { projectId: params.projectId, pageId: params.pageId || undefined, type: params.type },
  });
}

export interface ProjectAnalyticsSummary {
  projectId: string;
  projectName: string;
  views: number;
  hotspotOpens: number;
  audioPlays: number;
  last30DaysViews: { date: string; count: number }[];
}

/** Aggregates AnalyticsEvent rows per project for every project in an org. */
export async function getOrgAnalyticsSummary(orgId: string): Promise<ProjectAnalyticsSummary[]> {
  const projects = await db.project.findMany({ where: { orgId }, select: { id: true, name: true } });
  if (projects.length === 0) return [];

  const projectIds = projects.map((p) => p.id);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [counts, dailyViews] = await Promise.all([
    db.analyticsEvent.groupBy({
      by: ["projectId", "type"],
      where: { projectId: { in: projectIds } },
      _count: { _all: true },
    }),
    db.analyticsEvent.findMany({
      where: { projectId: { in: projectIds }, type: "view", createdAt: { gte: since } },
      select: { projectId: true, createdAt: true },
    }),
  ]);

  return projects.map((project) => {
    const forProject = counts.filter((c) => c.projectId === project.id);
    const views = forProject.find((c) => c.type === "view")?._count._all ?? 0;
    const hotspotOpens = forProject.find((c) => c.type === "hotspot_open")?._count._all ?? 0;
    const audioPlays = forProject.find((c) => c.type === "audio_play")?._count._all ?? 0;

    const byDay = new Map<string, number>();
    for (const row of dailyViews) {
      if (row.projectId !== project.id) continue;
      const day = row.createdAt.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    const last30DaysViews = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    return { projectId: project.id, projectName: project.name, views, hotspotOpens, audioPlays, last30DaysViews };
  });
}
