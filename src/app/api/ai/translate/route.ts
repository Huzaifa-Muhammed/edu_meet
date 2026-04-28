export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/server/auth/verify-token";
import { groqProvider } from "@/server/providers/ai/groq";
import { ok, fail } from "@/server/utils/response";

const Body = z.object({
  text: z.string().min(1).max(2000),
  /** ISO short code or "auto" — only used for the prompt, doesn't gate the call. */
  sourceLang: z.string().min(2).max(8).optional(),
  /** ISO short code, e.g. "en", "es", "fr". */
  targetLang: z.string().min(2).max(8),
});

const LANG_NAME: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  hi: "Hindi",
  ar: "Arabic",
  zh: "Chinese (Simplified)",
  pt: "Portuguese",
  ru: "Russian",
  ur: "Urdu",
  ja: "Japanese",
  ko: "Korean",
  it: "Italian",
};

/** Lightweight translation route used by the live-captions overlay. Caches
 *  are kept on the client; we just translate one short line at a time
 *  with a low-temperature Groq call so output stays close to literal. */
export async function POST(req: NextRequest) {
  try {
    await verifyToken(req);
    const body = Body.parse(await req.json());

    if (
      body.sourceLang &&
      body.sourceLang.toLowerCase() === body.targetLang.toLowerCase()
    ) {
      return ok({ translatedText: body.text, sourceLang: body.sourceLang });
    }

    const targetName = LANG_NAME[body.targetLang.toLowerCase()] ?? body.targetLang;
    const sourceName = body.sourceLang
      ? (LANG_NAME[body.sourceLang.toLowerCase()] ?? body.sourceLang)
      : "the source language";

    const system =
      "You are a real-time live-caption translator. Output ONLY the translation, no quotes, no preamble, no commentary. Preserve technical terms and proper nouns. If the text is already in the target language, return it unchanged.";
    const user = `Translate from ${sourceName} to ${targetName}:\n\n${body.text}`;

    const translated = await groqProvider.chat(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { temperature: 0.2 },
    );
    return ok({
      translatedText: translated.trim().replace(/^["']|["']$/g, ""),
      sourceLang: body.sourceLang ?? "auto",
    });
  } catch (e) {
    return fail(e);
  }
}
