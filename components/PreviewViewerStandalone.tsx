import type { Route } from "playwright";

export default function PreviewViewerStandalone({ project, isPublic = false }: { project: any; isPublic?: boolean }) {
  const pages = Array.isArray(project?.pages) ? project.pages : [];

  return (
    <div style={{ display: "grid", gap: 24, padding: 24, background: project?.theme?.bg ?? "#ffffff" }}>
      {pages.map((page: any, index: number) => (
        <section key={page?.id ?? index} style={{ display: "flex", justifyContent: "center" }}>
          <div
            style={{
              position: "relative",
              width: 800,
              minHeight: 1000,
              background: project?.theme?.bg ?? "#ffffff",
              color: project?.theme?.text ?? "#111111",
              border: "1px solid rgba(0,0,0,0.08)",
              boxShadow: "0 14px 40px rgba(0,0,0,0.08)",
              overflow: "hidden",
            }}
          >
            {(page?.blocks ?? []).filter((block: any) => !block.hidden).map((block: any, blockIndex: number) => {
              const baseStyle: React.CSSProperties = {
                position: "absolute",
                left: block.x ?? 0,
                top: block.y ?? 0,
                width: block.w ?? 200,
                height: block.h ?? 100,
                zIndex: block.z ?? blockIndex + 1,
              };

              if (block.type === "text") {
                return (
                  <div key={block.id ?? blockIndex} style={{ ...baseStyle, display: "flex", alignItems: "center", justifyContent: block.align ?? "left" }}>
                    <span
                      style={{
                        fontFamily: block.fontFamily ?? "sans-serif",
                        fontSize: block.fontSize ?? 18,
                        fontWeight: block.fontWeight ?? 400,
                        color: block.color ?? project?.theme?.text ?? "#111111",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {block.content ?? ""}
                    </span>
                  </div>
                );
              }

              if (block.type === "image") {
                return (
                  <img
                    key={block.id ?? blockIndex}
                    src={block.src}
                    alt=""
                    style={{
                      ...baseStyle,
                      objectFit: block.fit ?? "cover",
                      opacity: block.opacity ?? 1,
                    }}
                  />
                );
              }

              if (block.type === "shape") {
                return (
                  <div
                    key={block.id ?? blockIndex}
                    style={{
                      ...baseStyle,
                      background: block.fill ?? "#111111",
                      borderRadius: block.shape === "circle" ? "50%" : 0,
                      opacity: block.opacity ?? 1,
                    }}
                  />
                );
              }

              if (block.type === "audio") {
                return (
                  <div key={block.id ?? blockIndex} style={{ ...baseStyle, display: "flex", alignItems: "center", gap: 8, padding: 8, background: "rgba(17,17,17,0.06)" }}>
                    <span aria-hidden="true">♫</span>
                    <span>{block.label ?? "Audio"}</span>
                  </div>
                );
              }

              if (block.type === "hotspot") {
                return (
                  <button
                    key={block.id ?? blockIndex}
                    type="button"
                    style={{
                      ...baseStyle,
                      border: "1px dashed rgba(17,17,17,0.4)",
                      background: "transparent",
                      color: project?.theme?.text ?? "#111111",
                      fontSize: 11,
                    }}
                  >
                    {block.label ?? "Hotspot"}
                  </button>
                );
              }

              return null;
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
