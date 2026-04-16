import { GoogleGenerativeAI } from "@google/generative-ai";

function getGenAI(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  return new GoogleGenerativeAI(apiKey);
}

export function getGeminiModel() {
  const genAI = getGenAI();
  return genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}

/**
 * Extract problem text and LaTeX math from an image or PDF using Gemini Vision.
 * @param imageData base64-encoded file data
 * @param mimeType file MIME type (e.g. "image/jpeg", "application/pdf")
 */
export async function extractLatexFromImage(
  imageData: string,
  mimeType: string
): Promise<string> {
  const model = getGeminiModel();

  const result = await model.generateContent([
    {
      inlineData: {
        data: imageData,
        mimeType,
      },
    },
    `この画像に含まれる数学の問題を、以下のルールに従って正確に抽出してください。

- 問題文はそのままテキストで出力してください。
- 数式は LaTeX 形式（インラインは $...$ 、ディスプレイは $$...$$ ）で記述してください。
- 図形・グラフ・表がある場合は、その内容や条件を日本語で簡潔に説明してください。
- 問題が複数ある場合は番号ごとに改行して区切ってください。
- 前置きや補足説明は不要です。問題の内容のみを出力してください。`,
  ]);

  const response = await result.response;
  return response.text().trim();
}
