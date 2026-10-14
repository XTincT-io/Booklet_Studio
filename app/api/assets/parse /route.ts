import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import mammoth from "mammoth";
import pdf from "pdf-parse";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    let extractedText = "";

    if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      // Handle DOCX
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } else if (file.type === "application/pdf") {
      // Handle PDF
      const data = await pdf(buffer);
      extractedText = data.text;
    } else if (file.type === "text/plain") {
      // Handle TXT
      extractedText = buffer.toString("utf-8");
    } else {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    return NextResponse.json({ text: extractedText.trim() });
  } catch (error) {
    console.error("Parsing error:", error);
    return NextResponse.json({ error: "Failed to parse document" }, { status: 500 });
  }
}
