import { NextRequest, NextResponse } from "next/server";
import { extractLatexFromImage } from "@/lib/gemini/client";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File | null;

    if (!imageFile) {
      return NextResponse.json({ error: "画像ファイルが必要です" }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(imageFile.type)) {
      return NextResponse.json(
        { error: "JPEG、PNG、WebP、GIF形式の画像のみ対応しています" },
        { status: 400 }
      );
    }

    const bytes = await imageFile.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    const latex = await extractLatexFromImage(base64, imageFile.type);

    return NextResponse.json({ latex });
  } catch (error) {
    console.error("OCR error:", error);
    return NextResponse.json(
      { error: "OCR処理に失敗しました" },
      { status: 500 }
    );
  }
}
