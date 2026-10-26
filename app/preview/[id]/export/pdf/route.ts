import { NextRequest, NextResponse } from "next/server";
import { Browser, chromium, type Route } from "playwright";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasFeature } from "@/lib/entitlements";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: ["--disable-dev-shm-usage", "--no-sandbox"],
    });
  }

  return browserPromise;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await db.project.findUnique({
    where: { id: params.id },
    include: { org: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!hasFeature(project.org.tier, "hq_export")) {
    return NextResponse.json(
      {
        error: "HQ PDF Export requires Indie Artist tier or higher",
        code: "TIER_LIMIT",
      },
      { status: 402 },
    );
  }

  const browser = await getBrowser();
  const page = await browser.newPage();
  const previewUrl = new URL(`/preview/${encodeURIComponent(params.id)}`, req.nextUrl.origin).toString();
  const safeFileName = project.name.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "project";

  try {
    await page.route("**/*", async (route: Route) => {
      const resourceType = route.request().resourceType();

      if (["image", "font", "media"].includes(resourceType)) {
        await route.abort();
        return;
      }

      await route.continue();
    });

    await page.goto(previewUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    await page.waitForSelector("[data-pdf-ready='true']", { timeout: 15_000 }).catch(() => undefined);

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFileName}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Project preview PDF export failed", {
      projectId: params.id,
      previewUrl,
      error,
    });

    return NextResponse.json({ error: "Failed to generate PDF export" }, { status: 500 });
  } finally {
    await page.close();
  }
}
