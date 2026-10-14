import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasFeature } from "@/lib/entitlements";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await db.project.findUnique({ where: { id: params.id }, include: { org: true } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Tier Check: HQ Export is a paid feature
  if (!hasFeature(project.org.tier, "hq_export")) {
    return NextResponse.json({ error: "HQ PDF Export requires Indie Artist tier or higher", code: "TIER_LIMIT" }, { status: 402 });
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Navigate to the standalone preview page
  const previewUrl = `${process.env.APP_URL}/preview/${params.id}`;
  await page.goto(previewUrl, { waitUntil: "networkidle" });

  // Generate PDF
  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  await browser.close();

  return new Response(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${project.name.replace(/\s+/g, "_")}.pdf"`,
    },
  });
}
