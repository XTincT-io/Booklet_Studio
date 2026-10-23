import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasFeature } from "@/lib/entitlements";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await db.project.findFirst({
    where: {
      id,
      org: {
        memberships: {
          some: {
            userId: session.user.id,
          },
        },
      },
    },
    include: { org: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!hasFeature(project.org.tier, "hq_export")) {
    return NextResponse.json(
      {
        error: "HQ PDF Export requires Indie Artist tier or higher",
        code: "TIER_LIMIT",
      },
      { status: 402 }
    );
  }

  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    return NextResponse.json({ error: "Missing APP_URL" }, { status: 500 });
  }

  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    const previewUrl = `${appUrl}/preview/${id}`;

    await page.goto(previewUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    await page.waitForFunction(() => document.readyState === "complete", {
      timeout: 30_000,
    });

    await page.evaluate(async () => {
      if ("fonts" in document) {
        await document.fonts.ready;
      }
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    const safeName = (project.name || "booklet")
      .replace(/[^\w.-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "booklet";

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
      },
    });
  } catch (error) {
    console.error("HQ PDF export failed", error);
    return NextResponse.json({ error: "PDF export failed" }, { status: 500 });
  } finally {
    await browser.close();
  }
}
