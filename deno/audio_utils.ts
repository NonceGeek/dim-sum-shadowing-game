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

async function transcribeViaDashScope(
  config: {
    apiKey: string;
    model: string;
  },
  params: {
    file: File;
    filename?: string;
    language?: string;
    prompt?: string;
    task?: "transcribe" | "translate";
  },
): Promise<string> {
  const { apiKey, model } = config;
  const name = params.filename ?? params.file.name ?? "audio";
  const buf = new Uint8Array(await params.file.arrayBuffer());
  const base64Audio = uint8ArrayToBase64(buf);
  const lang = (params.language ?? "yue").trim().toLowerCase();
  const task = params.task === "translate" ? "translate" : "transcribe";

  if (task === "translate") {
    const transcribedText = await transcribeViaDashScope(config, {
      ...params,
      task: "transcribe",
    });

    let instruction =
      "Translate the following text into clear English. Output only the English translation, no labels or commentary.";
    if (params.prompt?.trim()) {
      instruction += ` Additional context: ${params.prompt.trim()}`;
    }

    const resp = await fetch(
      "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "qwen-plus",
          messages: [
            {
              role: "user",
              content: `${instruction}\n\nText to translate:\n${transcribedText}`,
            },
          ],
        }),
      },
    );

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`DashScope translation ${resp.status}: ${err.slice(0, 2000)}`);
    }

    const data = await resp.json();
    return data.choices?.[0]?.message?.content?.trim() ?? "";
  }

  const mimeType = params.file.type || "audio/m4a";
  const dataUrl = `data:${mimeType};base64,${base64Audio}`;
  const language = sttLanguageHint(lang) || "zh";

  const submitResp = await fetch(
    "https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify({
        model: "paraformer-v2",
        input: {
          file_urls: [dataUrl],
        },
        parameters: {
          language_hints: [language],
        },
      }),
    },
  );

  if (!submitResp.ok) {
    const err = await submitResp.text();
    throw new Error(`DashScope submit ${submitResp.status}: ${err.slice(0, 2000)}`);
  }

  const submitData = await submitResp.json();
  const taskId = submitData.output?.task_id;
  if (!taskId) {
    throw new Error("DashScope: no task_id in response");
  }

  let taskStatus = "PENDING";
  let transcriptionUrl = "";
  for (let i = 0; i < 30; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const taskResp = await fetch(
      `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      },
    );
    if (!taskResp.ok) {
      const err = await taskResp.text();
      throw new Error(`DashScope task poll ${taskResp.status}: ${err.slice(0, 2000)}`);
    }
    const taskData = await taskResp.json();
    taskStatus = taskData.output?.task_status;
    if (taskStatus === "SUCCEEDED") {
      transcriptionUrl = taskData.output?.results?.[0]?.transcription_url;
      break;
    } else if (taskStatus === "FAILED") {
      throw new Error(`DashScope task failed: ${JSON.stringify(taskData)}`);
    }
  }

  if (taskStatus !== "SUCCEEDED" || !transcriptionUrl) {
    throw new Error(`DashScope task did not complete in time (status: ${taskStatus})`);
  }

  const transcriptionResp = await fetch(transcriptionUrl);
  if (!transcriptionResp.ok) {
    const err = await transcriptionResp.text();
    throw new Error(`DashScope transcription fetch ${transcriptionResp.status}: ${err.slice(0, 2000)}`);
  }

  const transcriptionData = await transcriptionResp.json();
  const text = transcriptionData.transcripts?.[0]?.text?.trim() ?? "";
  return text;
}

async function transcribeViaOpenRouter(
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

export async function transcribeCantoneseAudio(
  config: {
    dashScopeApiKey?: string;
    dashScopeModel?: string;
    apiKey?: string;
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
  if (config.dashScopeApiKey) {
    try {
      return await transcribeViaDashScope(
        {
          apiKey: config.dashScopeApiKey,
          model: config.dashScopeModel || "qwen3-asr-flash",
        },
        params,
      );
    } catch (err) {
      console.warn("DashScope failed, falling back to OpenRouter:", err);
      if (!config.apiKey) throw err;
    }
  }

  if (!config.apiKey) throw new Error("No API key configured (DASHSCOPE_API_KEY or API_KEY)");
  return transcribeViaOpenRouter(
    {
      apiKey: config.apiKey,
      model: config.model,
      httpReferer: config.httpReferer,
      siteTitle: config.siteTitle,
    },
    params,
  );
}
