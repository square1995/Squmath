import { GoogleGenerativeAI } from "@google/generative-ai";

const PROMPT = `この画像に含まれる数学の問題を、以下のルールに従って正確に抽出してください。

- 問題文はそのままテキストで出力してください。
- 数式は LaTeX 形式（インラインは $...$ 、ディスプレイは $$...$$ ）で記述してください。
- 図形・グラフ・表がある場合は、その内容や条件を日本語で簡潔に説明してください。
- 問題が複数ある場合は番号ごとに改行して区切ってください。
- 前置きや補足説明は不要です。問題の内容のみを出力してください。`;

const FALLBACK_CANDIDATES = [
  { model: "gemini-3.1-flash-lite-preview", envKey: "GEMINI_API_KEY" },
  { model: "gemini-3.1-flash-lite-preview", envKey: "GEMINI_API_KEY_BACKUP" },
  { model: "gemini-2.5-flash",              envKey: "GEMINI_API_KEY" },
  { model: "gemini-2.5-flash",              envKey: "GEMINI_API_KEY_BACKUP" },
] as const;

/**
 * Extract problem text and LaTeX math from an image or PDF using Gemini Vision.
 * Tries each (model, API key) combination in order and returns the first success.
 * @param imageData base64-encoded file data
 * @param mimeType file MIME type (e.g. "image/jpeg", "application/pdf")
 */
export async function extractLatexFromImage(
  imageData: string,
  mimeType: string
): Promise<string> {
  const errors: string[] = [];

  for (const { model, envKey } of FALLBACK_CANDIDATES) {
    const apiKey = process.env[envKey];
    if (!apiKey) continue;

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const geminiModel = genAI.getGenerativeModel({ model });

      const result = await geminiModel.generateContent([
        { inlineData: { data: imageData, mimeType } },
        PROMPT,
      ]);

      return result.response.text().trim();
    } catch (err) {
      errors.push(
        `${model} (${envKey}): ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  throw new Error(`全ての Gemini API 呼び出しに失敗しました:\n${errors.join("\n")}`);
}
