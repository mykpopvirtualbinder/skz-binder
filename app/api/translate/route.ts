import { NextResponse } from "next/server";

type TranslateBody = {
  text?: string;
  targetLang?: string;
  mode?: "single" | "batch";
  targetLangs?: string[];
};

type GeminiGenerateJson = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
};

const SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" },
];

function extractGeminiText(genJson: GeminiGenerateJson): string {
  const parts = genJson?.candidates?.[0]?.content?.parts || [];
  return parts
    .map((part) => String(part?.text || ""))
    .join("")
    .trim();
}

function fallbackLang(code: string): string {
  if (code === "zh") return "zh-CN";
  if (code === "jp") return "ja";
  if (code === "kr") return "ko";
  return code;
}

function splitFallbackChunks(text: string, maxLen = 450): string[] {
  const parts = String(text || "").split(/(\n+)/);
  const chunks: string[] = [];
  let buf = "";
  const pushBuf = () => {
    if (buf) chunks.push(buf);
    buf = "";
  };
  for (const part of parts) {
    if (!part) continue;
    if (part.length > maxLen) {
      pushBuf();
      for (let i = 0; i < part.length; i += maxLen) {
        chunks.push(part.slice(i, i + maxLen));
      }
      continue;
    }
    const next = buf + part;
    if (next.length > maxLen) {
      pushBuf();
      buf = part;
    } else {
      buf = next;
    }
  }
  pushBuf();
  return chunks.length ? chunks : [""];
}

function parseGtxPayload(data: unknown): string {
  if (!Array.isArray(data) || !Array.isArray(data[0])) return "";
  return data[0]
    .map((row) => (Array.isArray(row) ? String(row[0] || "") : ""))
    .join("")
    .trim();
}

async function translateWithGtx(text: string, targetLang: string): Promise<string> {
  const tl = fallbackLang(targetLang);
  const pieces = splitFallbackChunks(text);
  const out: string[] = [];
  for (const piece of pieces) {
    if (!piece.trim()) {
      out.push(piece);
      continue;
    }
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=es&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(piece)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) throw new Error(`GTX_${res.status}`);
    const translated = parseGtxPayload(await res.json().catch(() => null));
    if (!translated) throw new Error("GTX_EMPTY");
    out.push(translated);
  }
  return out.join("").trim();
}

async function translateWithMyMemory(text: string, targetLang: string): Promise<string> {
  const tl = fallbackLang(targetLang);
  const pieces = splitFallbackChunks(text, 400);
  const out: string[] = [];
  for (const piece of pieces) {
    if (!piece.trim()) {
      out.push(piece);
      continue;
    }
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(piece)}&langpair=es|${encodeURIComponent(tl)}`;
    const res = await fetch(url);
    const json = (await res.json().catch(() => ({}))) as {
      responseData?: { translatedText?: string };
    };
    const translated = String(json?.responseData?.translatedText || "").trim();
    if (!res.ok || !translated) throw new Error(`MYMEMORY_${res.status || "EMPTY"}`);
    out.push(translated);
  }
  return out.join("").trim();
}

async function translateWithFallback(text: string, targetLang: string): Promise<{
  translation: string;
  provider: string;
}> {
  try {
    const translation = await translateWithGtx(text, targetLang);
    if (translation) return { translation, provider: "gtx" };
  } catch {
    /* try next */
  }
  const translation = await translateWithMyMemory(text, targetLang);
  if (!translation) throw new Error("FALLBACK_EMPTY");
  return { translation, provider: "mymemory" };
}

export async function POST(req: Request) {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    "";

  if (!apiKey) {
    return NextResponse.json(
      { error: "Translation API key is missing", reason: "MISSING_API_KEY" },
      { status: 500 }
    );
  }

  let body: TranslateBody;
  try {
    body = (await req.json()) as TranslateBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", reason: "INVALID_JSON" },
      { status: 400 }
    );
  }

  const text = String(body.text || "").trim();
  const targetLang = String(body.targetLang || "es").trim().toLowerCase();
  const mode = body.mode === "batch" ? "batch" : "single";
  const targetLangs = Array.isArray(body.targetLangs)
    ? body.targetLangs.map((l) => String(l || "").trim().toLowerCase()).filter(Boolean)
    : [];
  if (!text) {
    return NextResponse.json(
      { error: "Text is required", reason: "MISSING_TEXT" },
      { status: 400 }
    );
  }

  try {
    const safeText = JSON.stringify(text);
    const prompt =
      mode === "batch"
        ? `Translate this fanfic from Spanish into the requested languages and return ONLY valid JSON.
The input is always: TITLE, then a line with exactly |||, then BODY.
For EVERY language value you MUST keep that exact structure: translated TITLE, newline, |||, newline, translated BODY.
Translate the title AND the body. Never omit the title. Never drop the ||| separator. Never add extra |||.
Output format: {"en":"Title\\n|||\\nBody","fr":"Titre\\n|||\\nCorps"} (keys = language codes).
Target languages: ${JSON.stringify(targetLangs.length ? targetLangs : ["en"])}
Text: ${safeText}`
        : `You are a literary translator. Translate this fictional adult fanfic excerpt from Spanish to '${targetLang}'.
Keep the same meaning, tone, names and explicitness. Do not refuse, summarize, censor or comment.
If the input contains |||, keep exactly one ||| between the translated title and the translated body.
Return ONLY the translated text.

${text}`;
    const listRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      { method: "GET" }
    );
    const listJson = (await listRes.json().catch(() => ({}))) as {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
      error?: { message?: string };
    };
    if (!listRes.ok) {
      throw new Error(
        `LIST_MODELS_FAILED_${listRes.status}: ${listJson?.error?.message || "unknown"}`
      );
    }

    const models = (listJson.models || []).filter((m) =>
      (m.supportedGenerationMethods || []).includes("generateContent")
    );
    const preferred = [
      "models/gemini-2.0-flash",
      "models/gemini-2.0-flash-lite",
      "models/gemini-2.5-flash",
      "models/gemini-1.5-flash",
      "models/gemini-1.5-pro",
    ];
    const modelCandidates = preferred.filter((p) => models.some((m) => m.name === p));
    if (!modelCandidates.length && models[0]?.name) modelCandidates.push(models[0].name);

    if (!modelCandidates.length) {
      return NextResponse.json(
        { error: "No compatible model available", reason: "MODEL_UNAVAILABLE" },
        { status: 502 }
      );
    }

    let picked = "";
    let rawOutput = "";
    let lastDetails = "";
    for (const modelName of modelCandidates) {
      const genRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 8192,
              ...(modelName.includes("2.5")
                ? { thinkingConfig: { thinkingBudget: 0 } }
                : {}),
            },
            safetySettings: SAFETY_SETTINGS,
          }),
        }
      );
      const genJson = (await genRes.json().catch(() => ({}))) as GeminiGenerateJson;
      if (!genRes.ok) {
        lastDetails = `GENERATE_FAILED_${genRes.status}: ${genJson?.error?.message || "unknown"}`;
        continue;
      }
      rawOutput = extractGeminiText(genJson);
      if (rawOutput) {
        picked = modelName;
        break;
      }
      lastDetails = [
        genJson?.candidates?.[0]?.finishReason || "UNKNOWN",
        genJson?.promptFeedback?.blockReason || "",
      ]
        .filter(Boolean)
        .join(" ");
    }

    if (!rawOutput && mode === "single") {
      try {
        const fallback = await translateWithFallback(text, targetLang);
        return NextResponse.json({
          translation: fallback.translation,
          model: "fallback",
          provider: fallback.provider,
        });
      } catch (fallbackError) {
        lastDetails = `${lastDetails} FALLBACK:${String(fallbackError || "")}`.trim();
      }
    }

    if (!rawOutput) {
      return NextResponse.json(
        { error: "Empty translation", reason: "EMPTY_TRANSLATION", details: lastDetails },
        { status: 502 }
      );
    }
    if (mode === "batch") {
      let translations: Record<string, string> = {};
      const cleaned = rawOutput.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      try {
        translations = JSON.parse(cleaned) as Record<string, string>;
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON from translation model", reason: "INVALID_MODEL_JSON" },
          { status: 502 }
        );
      }
      return NextResponse.json({ translations, model: picked, provider: "gemini" });
    }

    return NextResponse.json({ translation: rawOutput, model: picked, provider: "gemini" });
  } catch (error) {
    const message = String(error || "");
    const lower = message.toLowerCase();
    let reason = "TRANSLATE_UPSTREAM_ERROR";
    if (lower.includes("api_key_invalid") || lower.includes("api key not valid"))
      reason = "API_KEY_INVALID";
    else if (
      lower.includes("quota") ||
      lower.includes("resource_exhausted") ||
      lower.includes("rate limit") ||
      lower.includes("too many requests") ||
      lower.includes("generate_failed_429")
    )
      reason = "QUOTA_EXCEEDED";
    else if (
      lower.includes("permission_denied") ||
      lower.includes("denied access") ||
      lower.includes("generate_failed_403")
    )
      reason = "PERMISSION_DENIED";
    else if (
      lower.includes("request denied") ||
      lower.includes("api has not been used") ||
      lower.includes("access not configured")
    )
      reason = "API_NOT_ENABLED_OR_RESTRICTED";
    else if (lower.includes("not found") || lower.includes("model"))
      reason = "MODEL_UNAVAILABLE";
    else if (lower.includes("deadline") || lower.includes("timeout"))
      reason = "UPSTREAM_TIMEOUT";

    return NextResponse.json(
      { error: "Translation failed", reason, details: message },
      { status: 502 }
    );
  }
}
