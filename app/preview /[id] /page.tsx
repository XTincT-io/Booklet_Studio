import { db } from "@/lib/db";
import PreviewViewer from "@/components/PreviewViewerStandalone"; // We'll create this next
import { notFound } from "next/navigation";

export default async function PublicPreviewPage({ params }: { params: { id: string } }) {
  const project = await db.project.findUnique({
    where: { id: params.id },
    include: { pages: { orderBy: { order: "asc" } } },
  });

  if (!project) notFound();

  return (
    <div className="bs-print-root">
      <PreviewViewer project={project as any} isPublic />
    </div>
  );
}
