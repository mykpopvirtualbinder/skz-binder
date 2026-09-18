import { NextResponse } from "next/server";

type TranslateBody = {
  text?: string;
  targetLang?: string;
  mode?: "single" | "batch";
  targetLangs?: string[];
};

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
        : `Translate this text to '${targetLang}'. If the input contains |||, keep exactly one ||| between the translated title and the translated body. Return ONLY the translated text.\nMessage: ${safeText}`;
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
      "models/gemini-2.5-flash",
      "models/gemini-2.0-flash",
      "models/gemini-2.0-flash-lite",
      "models/gemini-1.5-flash",
      "models/gemini-1.5-pro",
    ];
    const picked =
      preferred.find((p) => models.some((m) => m.name === p)) ||
      models[0]?.name;

    if (!picked) {
      return NextResponse.json(
        { error: "No compatible model available", reason: "MODEL_UNAVAILABLE" },
        { status: 502 }
      );
    }

    const genRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${picked}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        }),
      }
    );
    const genJson = (await genRes.json().catch(() => ({}))) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      error?: { message?: string };
    };
    if (!genRes.ok) {
      throw new Error(
        `GENERATE_FAILED_${genRes.status}: ${genJson?.error?.message || "unknown"}`
      );
    }
    const rawOutput =
      genJson?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    if (!rawOutput) {
      return NextResponse.json(
        { error: "Empty translation", reason: "EMPTY_TRANSLATION" },
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
