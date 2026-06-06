export function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const sub = bytes.subarray(i, i + CHUNK);
    parts.push(String.fromCharCode.apply(null, sub as unknown as number[]));
  }
  return btoa(parts.join(""));
}

/** Map filename / MIME to OpenRouter input_audio format (lowercase extension). */
export function inferAudioFormat(filename: string, mimeType: string): string {
  const lower = filename.toLowerCase();
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".") + 1) : "";
  const allowed = new Set([
    "wav",
    "mp3",
    "m4a",
    "flac",
    "ogg",
    "aac",
    "aiff",
    "webm",
    "pcm16",
    "pcm24",
  ]);
  if (ext && allowed.has(ext)) return ext;
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("webm")) return "webm";
  return "wav";
}

/** Map BCP-47 / Cantonese hints to ISO-639-1 for OpenRouter STT `language`. */
export function sttLanguageHint(lang: string): string | undefined {
  const lower = lang.trim().toLowerCase();
  if (!lower || lower === "auto") return undefined;
  if (lower === "yue" || lower === "zh-yue" || lower.includes("cantonese")) return "zh";
  return lower.length <= 3 ? lower : lower.slice(0, 2);
}

export function openRouterHeaders(
  apiKey: string,
  httpReferer = "",
  siteTitle = "",
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (httpReferer) headers["HTTP-Referer"] = httpReferer;
  if (siteTitle) headers["X-OpenRouter-Title"] = siteTitle;
  return headers;
}

/**
 * Cantonese audio via OpenRouter STT: POST /v1/audio/transcriptions with base64 input_audio.
 * `task: "translate"` falls back to chat completions (STT endpoint is transcribe-only).
 */
export async function transcribeCantoneseAudio(
  config: {
    apiKey: string;
    model: string;
    httpReferer?: string;
    siteTitle?: string;
  },
  params: {
    file: File;
    filename?: string;
    language?: string;
    prompt?: string;
    task?: "transcribe" | "translate";
  },
): Promise<string> {
  const { apiKey, model, httpReferer = "", siteTitle = "" } = config;
  if (!apiKey) throw new Error("API_KEY not configured");

  const name = params.filename ?? params.file.name ?? "audio";
  const buf = new Uint8Array(await params.file.arrayBuffer());
  const base64Audio = uint8ArrayToBase64(buf);
  const format = inferAudioFormat(name, params.file.type || "");
  const headers = openRouterHeaders(apiKey, httpReferer, siteTitle);

  const lang = (params.language ?? "yue").trim().toLowerCase();
  const task = params.task === "translate" ? "translate" : "transcribe";

  if (task === "translate") {
    let instruction =
      "Listen to this audio and translate the speech into clear English. Output only the English translation, no labels or commentary.";
    if (params.prompt?.trim()) {
      instruction += ` Additional context: ${params.prompt.trim()}`;
    }

    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: instruction },
              {
                type: "input_audio",
                input_audio: { data: base64Audio, format },
              },
            ],
          },
        ],
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`OpenRouter translation ${resp.status}: ${err.slice(0, 2000)}`);
    }

    const data = await resp.json();
    return data.choices?.[0]?.message?.content?.trim() ?? "";
  }

  const body: Record<string, unknown> = {
    model,
    input_audio: { data: base64Audio, format },
  };
  const language = sttLanguageHint(lang);
  if (language) body.language = language;

  const resp = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenRouter transcription ${resp.status}: ${err.slice(0, 2000)}`);
  }

  const data = await resp.json();
  return data.text?.trim() ?? "";
}
