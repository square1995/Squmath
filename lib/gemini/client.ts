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
  return genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
}

/**
 * Extract LaTeX math from an image using Gemini Vision.
 * @param imageData base64-encoded image data
 * @param mimeType image MIME type (e.g. "image/jpeg")
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
    `この画像に含まれる数学の問題や数式を、LaTeX形式で正確に抽出してください。
数式のみをLaTeX形式で出力し、説明文は含めないでください。
複数の数式がある場合は改行で区切ってください。`,
  ]);

  const response = await result.response;
  return response.text().trim();
}
