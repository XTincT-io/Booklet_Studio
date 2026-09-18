import { db } from "./db";
import type { MetadataFields, PageData, ProjectFull, ThemeData } from "./types";

export async function loadProjectFull(projectId: string): Promise<ProjectFull | null> {
  const project = await db.project.findUnique({ where: { id: projectId }, include: { pages: { orderBy: { order: "asc" } } } });
  if (!project) return null;

  return {
    id: project.id,
    name: project.name,
    artist: project.artist,
    formatId: project.formatId,
    status: project.status,
    theme: project.theme as unknown as ThemeData,
    metadata: project.metadata as unknown as MetadataFields,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    pages: project.pages.map((p) => ({ id: p.id, name: p.name, order: p.order, blocks: p.blocks as unknown as PageData["blocks"] })),
  };
}
