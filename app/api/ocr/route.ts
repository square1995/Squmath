import { NextRequest, NextResponse } from "next/server";
import { extractLatexFromImage } from "@/lib/gemini/client";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "ファイルが必要です" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "JPEG・PNG・WebP・GIF・PDF形式のファイルのみ対応しています" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    const latex = await extractLatexFromImage(base64, file.type);

    return NextResponse.json({ latex });
  } catch (error) {
    console.error("OCR error:", error);
    return NextResponse.json(
      { error: "OCR処理に失敗しました" },
      { status: 500 }
    );
  }
}
