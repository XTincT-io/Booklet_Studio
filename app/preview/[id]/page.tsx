import { db } from "@/lib/db";
import PreviewViewer from "@/components/PreviewViewerStandalone";
import { notFound } from "next/navigation";

export default async function PreviewPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  const project = await db.project.findUnique({
    where: { id },
    include: { pages: { orderBy: { order: "asc" } } },
  });

  if (!project) {
    notFound();
  }

  return (
    <div className="bs-print-root">
      <PreviewViewer project={project as any} isPublic />
    </div>
  );
}
