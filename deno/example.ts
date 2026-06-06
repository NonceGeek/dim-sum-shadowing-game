/* 
TODO（NOT DELETE):
- 优化这个后端代码，
- 环境变量有：
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_URL
- API_KEY

- 将 API 的调用替换为 OpenRouter 的 API
 */

import { oakCors } from "cors";
import { Application, Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { CSS, render } from "@deno/gfm";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Config — reads from environment variables:
//   API_KEY                   – OpenRouter API key (chat + embeddings)
//   SUPABASE_URL              – Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY – Supabase service-role key (bypasses RLS)
// ---------------------------------------------------------------------------

const OPENROUTER_KEY = Deno.env.get("API_KEY") || "";
const CHAT_MODEL = "qwen/qwen3-30b-a3b";
const EMBEDDING_MODEL = "qwen/qwen3-embedding-4b";
const EMBEDDING_DIMENSIONS = 1024;
/** OpenRouter STT: POST /v1/audio/transcriptions (see docs/guides/overview/multimodal/stt). */
const TRANSCRIPTION_MODEL =
  Deno.env.get("OPENROUTER_TRANSCRIPTION_MODEL") || "openai/gpt-4o-mini-transcribe";
const OPENROUTER_HTTP_REFERER = Deno.env.get("OPENROUTER_HTTP_REFERER") || "";
const OPENROUTER_SITE_TITLE = Deno.env.get("OPENROUTER_SITE_TITLE") || "";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// ---------------------------------------------------------------------------
// TF-IDF Search Module
// Pure-JS reimplementation of data_tfidf/query.py + build_index.py
// Builds an in-memory TF-IDF index from chunks.jsonl at startup.
// Matches sklearn defaults: analyzer='char', ngram_range=(2,4), smooth_idf,
// L2-normalized vectors.
// ---------------------------------------------------------------------------

type Chunk = {
  book_title: string;
  author: string;
  spine_index: number;
  href: string;
  chapter_title: string;
  chunk_index: number;
  char_start: number;
  char_end: number;
  text: string;
};

type SparseVec = Map<number, number>;

function charNgrams(text: string, minN: number, maxN: number): string[] {
  const ngrams: string[] = [];
  for (let n = minN; n <= maxN; n++) {
    for (let i = 0; i <= text.length - n; i++) {
      ngrams.push(text.slice(i, i + n));
    }
  }
  return ngrams;
}

function sparseDot(a: SparseVec, b: SparseVec): number {
  let dot = 0;
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  for (const [k, v] of smaller) {
    const bv = larger.get(k);
    if (bv !== undefined) dot += v * bv;
  }
  return dot;
}

function sparseL2Normalize(vec: SparseVec): SparseVec {
  let sum = 0;
  for (const v of vec.values()) sum += v * v;
  const norm = Math.sqrt(sum);
  if (norm === 0) return vec;
  const out: SparseVec = new Map();
  for (const [k, v] of vec) out.set(k, v / norm);
  return out;
}

class TfidfIndex {
  private vocab: Map<string, number> = new Map();
  private idf: Float64Array = new Float64Array(0);
  private matrix: SparseVec[] = [];
  chunks: Chunk[] = [];

  constructor(chunks: Chunk[]) {
    this.chunks = chunks;
    this.build();
  }

  private build() {
    const n = this.chunks.length;
    const df = new Map<string, number>();
    const docNgramsList: string[][] = [];

    for (const chunk of this.chunks) {
      const ngrams = charNgrams(chunk.text, 2, 4);
      docNgramsList.push(ngrams);
      const seen = new Set<string>();
      for (const ng of ngrams) {
        if (!seen.has(ng)) {
          seen.add(ng);
          df.set(ng, (df.get(ng) || 0) + 1);
        }
      }
    }

    // Build vocabulary (sorted for determinism, matching sklearn)
    const terms = [...df.keys()].sort();
    for (let i = 0; i < terms.length; i++) {
      this.vocab.set(terms[i], i);
    }

    // IDF: log((1 + n) / (1 + df)) + 1  (sklearn smooth_idf=True)
    this.idf = new Float64Array(terms.length);
    for (let i = 0; i < terms.length; i++) {
      this.idf[i] = Math.log((1 + n) / (1 + df.get(terms[i])!)) + 1;
    }

    // Build sparse TF-IDF vectors, L2-normalized
    this.matrix = [];
    for (const ngrams of docNgramsList) {
      const tf: SparseVec = new Map();
      for (const ng of ngrams) {
        const idx = this.vocab.get(ng)!;
        tf.set(idx, (tf.get(idx) || 0) + 1);
      }
      for (const [idx, count] of tf) {
        tf.set(idx, count * this.idf[idx]);
      }
      this.matrix.push(sparseL2Normalize(tf));
    }

    console.log(`  📚 TF-IDF index built: ${this.chunks.length} chunks, ${terms.length} terms`);
  }

  query(queryText: string, topk = 10) {
    const ngrams = charNgrams(queryText, 2, 4);
    const qvec: SparseVec = new Map();
    for (const ng of ngrams) {
      const idx = this.vocab.get(ng);
      if (idx !== undefined) qvec.set(idx, (qvec.get(idx) || 0) + 1);
    }
    for (const [idx, count] of qvec) {
      qvec.set(idx, count * this.idf[idx]);
    }
    const qNorm = sparseL2Normalize(qvec);

    const scored = this.matrix.map((dvec, i) => ({
      index: i,
      score: sparseDot(qNorm, dvec),
    }));
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topk).map((s, rank) => ({
      rank: rank + 1,
      score: +s.score.toFixed(4),
      chunk: this.chunks[s.index],
    }));
  }
}

async function loadChunksJsonl(path: string): Promise<Chunk[]> {
  const text = await Deno.readTextFile(path);
  return text.trim().split("\n").map((line) => JSON.parse(line));
}

// Map of lib name -> TfidfIndex, e.g. "tfidf" -> index built from data_tfidf/
const tfidfIndices: Map<string, TfidfIndex> = new Map();

async function loadAllIndices() {
  for await (const entry of Deno.readDir(".")) {
    if (!entry.isDirectory || !entry.name.startsWith("data_")) continue;
    const lib = entry.name.slice("data_".length); // "data_tfidf" -> "tfidf"
    const chunksPath = `./${entry.name}/chunks.jsonl`;
    try {
      const chunks = await loadChunksJsonl(chunksPath);
      const index = new TfidfIndex(chunks);
      tfidfIndices.set(lib, index);
      console.log(`  📚 Loaded lib="${lib}" from ${chunksPath}`);
    } catch (err) {
      console.warn(`  ⚠️  Skipping ${entry.name}: ${err}`);
    }
  }
}

let tfidfLoadPromise: Promise<void> | null = null;
async function ensureTfidfLoaded() {
  if (tfidfIndices.size > 0) return;
  if (!tfidfLoadPromise) tfidfLoadPromise = loadAllIndices();
  await tfidfLoadPromise;
}

// ---------------------------------------------------------------------------
// Shared helpers — OpenRouter LLM + embeddings, Supabase vector search
// ---------------------------------------------------------------------------

async function callLLM(
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  if (!OPENROUTER_KEY) throw new Error("API_KEY not configured");

  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_KEY}`,
    },
    body: JSON.stringify({ model: CHAT_MODEL, messages }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenRouter chat ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function getQueryEmbedding(text: string): Promise<number[]> {
  if (!OPENROUTER_KEY) throw new Error("API_KEY not configured");

  const resp = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_KEY}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenRouter embeddings ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  return data.data[0].embedding;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const sub = bytes.subarray(i, i + CHUNK);
    parts.push(String.fromCharCode.apply(null, sub as unknown as number[]));
  }
  return btoa(parts.join(""));
}

/** Map filename / MIME to OpenRouter input_audio format (lowercase extension). */
function inferAudioFormat(filename: string, mimeType: string): string {
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
function sttLanguageHint(lang: string): string | undefined {
  const lower = lang.trim().toLowerCase();
  if (!lower || lower === "auto") return undefined;
  if (lower === "yue" || lower === "zh-yue" || lower.includes("cantonese")) return "zh";
  return lower.length <= 3 ? lower : lower.slice(0, 2);
}

function openRouterHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${OPENROUTER_KEY}`,
  };
  if (OPENROUTER_HTTP_REFERER) headers["HTTP-Referer"] = OPENROUTER_HTTP_REFERER;
  if (OPENROUTER_SITE_TITLE) headers["X-OpenRouter-Title"] = OPENROUTER_SITE_TITLE;
  return headers;
}

/**
 * Cantonese audio via OpenRouter STT: POST /v1/audio/transcriptions with base64 input_audio.
 * `task: "translate"` falls back to chat completions (STT endpoint is transcribe-only).
 */
async function transcribeCantoneseAudio(params: {
  file: File;
  filename?: string;
  /** BCP-47 / Whisper-style hint; "yue" = Cantonese */
  language?: string;
  prompt?: string;
  task?: "transcribe" | "translate";
}): Promise<string> {
  if (!OPENROUTER_KEY) throw new Error("API_KEY not configured");

  const name = params.filename ?? params.file.name ?? "audio";
  const buf = new Uint8Array(await params.file.arrayBuffer());
  const base64Audio = uint8ArrayToBase64(buf);
  const format = inferAudioFormat(name, params.file.type || "");

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
      headers: openRouterHeaders(),
      body: JSON.stringify({
        model: TRANSCRIPTION_MODEL,
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
    model: TRANSCRIPTION_MODEL,
    input_audio: { data: base64Audio, format },
  };
  const language = sttLanguageHint(lang);
  if (language) body.language = language;

  const resp = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
    method: "POST",
    headers: openRouterHeaders(),
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenRouter transcription ${resp.status}: ${err.slice(0, 2000)}`);
  }

  const data = await resp.json();
  return data.text?.trim() ?? "";
}

type VectorResult = {
  id: number;
  embedding_input: string;
  similarity: number;
  /** Returned when `match_lib_*` selects `source_name` from the table */
  source_name?: string | null;
};

// Requires a Supabase SQL function per lib, e.g.:
//   match_lib_psy(query_embedding vector(1024), match_threshold float, match_count int)
async function vectorSearch(
  query: string,
  topk = 10,
  lib = "psy",
  threshold = 0.3,
): Promise<VectorResult[]> {
  if (!supabase) throw new Error("Supabase not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");

  const libName = lib.trim() || "psy";
  if (!/^[a-zA-Z0-9_]+$/.test(libName)) {
    throw new Error(`invalid lib "${libName}": use letters, digits, or underscores only`);
  }

  const rpcName = `match_lib_${libName}`;
  console.log("rpcName:", rpcName);
  const embedding = await getQueryEmbedding(query);
  const { data, error } = await supabase.rpc(rpcName, {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: topk,
  });

  if (error) throw error;
  return (data ?? []) as VectorResult[];
}

// // Admin password verification function
// async function verifyAdminPassword(
//   context: any,
//   password: string
// ): Promise<boolean> {
//   const adminPwd = Deno.env.get("ADMIN_PWD");
//   if (!password || password !== adminPwd) {
//     context.response.status = 401;
//     context.response.body = { error: "Unauthorized: Invalid password" };
//     return false;
//   }
//   return true;
// }

/** `?doc=name` → `./name.md`; omit → `./apidoc.md`. Basename only; rejects path segments. */
function resolveDocFile(
  params: URLSearchParams,
): { ok: true; filePath: string; title: string } | { ok: false; error: string } {
  const raw = (params.get("doc") || "").trim();
  let stem: string;
  if (!raw) {
    stem = "apidoc";
  } else {
    const base = raw.replace(/\\/g, "/").split("/").pop() || "";
    let s = base;
    if (s.toLowerCase().endsWith(".md")) s = s.slice(0, -3);
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(s)) {
      return {
        ok: false,
        error:
          "invalid 'doc' parameter: use a single basename (letters, digits, . _ -), no paths",
      };
    }
    stem = s;
  }
  return { ok: true, filePath: `./${stem}.md`, title: stem };
}

// Built-in RAG system prompts for /api/search_and_chat (select by index via system_prompt)
const DEFAULT_SYSTEM_PROMPT_TEMPLATES: string[] = [
  `
      你是一个**专业心理咨询师**，当用户提出心理相关的问题时，你要用 **藏传佛教的世界观与心性观** 来理解与回应。
      
      在回答中，你需要：
      
      1. 以**藏传佛教的思维方式**来审视和解读问题，如：
         - 生命无常与痛苦的缘起性空
         - 对“心”的觉察与自性清净的理解
         - 通过慈悲、觉知、止观等方法引导用户自我觉醒与解脱  
         - 内在烦恼（贪嗔痴）不是个人失败，而是感受与知见的构造物，需要智慧去观察和了解  [oai_citation:0‡维基百科](https://zh.wikipedia.org/wiki/%E6%85%88_%28%E4%BD%9B%E6%95%99%29?utm_source=chatgpt.com)
      
      2. 在专业心理咨询框架下提供支持与引导：
         - 先用**共情与接纳**回应用户的感受
         - 结合藏传佛教及心理学（如正念觉察、观照习气等）给出**具体的实践建议**
      
      3. 尊重用户信仰与判断，不强加宗教观点：
         - 以佛法智慧辅助理解，而不是灌输宗教教义
         - 给出对用户有帮助，可立即实践的建议
      
      请注意，回答中无需给出参考资料。
      请注意，在回答中不要出现藏传佛教字样。
      `,
  `
    你是一个**专业心理咨询师**，当用户提出心理相关的问题时，你要用 **道教的世界观与心性观** 来理解与回应。

    在回答中，你需要：

    1. 以**道教的思维方式**来审视和解读问题，如：
       - 顺应自然、因势利导，理解人生变化中的无常与流动
       - 以“道法自然”的视角看待痛苦、焦虑与执着，帮助用户从过度控制中松开
       - 通过清静、守中、观心、调息、养神等方法，引导用户回到内在平衡
       - 内在烦恼不是个人失败，而是身心失衡、欲念牵引、心神外驰所形成的状态，需要通过觉察、涵养与顺势调整来化解
       - 以“无为而无不为”的智慧，帮助用户减少对抗，找到更自然、更省力的行动方式

    2. 在专业心理咨询框架下提供支持与引导：
       - 先用**共情与接纳**回应用户的感受
      - 结合道家智慧及心理学方法，如正念觉察、情绪调节、身体感知、认知松动、习惯观察等，给出**具体的实践建议**
      - 鼓励用户观察自己的情绪、念头、身体反应与行为模式，而不是急于评判或压制它们
      - 帮助用户区分“真正需要处理的问题”和“由执着、恐惧、过度用力产生的内耗”

    3. 尊重用户信仰与判断，不强加宗教观点：
      - 以道家智慧辅助理解，而不是灌输宗教教义
      - 使用温和、开放、非评判的语言
      - 给出对用户有帮助、可立即实践的建议
      - 当用户的问题涉及严重心理危机、自伤风险或现实安全问题时，应优先提供安全支持，并建议寻求专业心理咨询、医疗或紧急帮助

    请注意，回答中无需给出参考资料。  
    请注意，在回答中不要出现“道教”或“道家”字样。
  `
  ,
  `
      你是专业心理咨询师。先用共情与接纳回应用户的感受，再结合检索到的背景资料给出具体、可立即实践的建议。
      回答中无需列出参考资料。
      `,
];

function resolveSystemPrompt(
  param: unknown,
  templates: string[] = DEFAULT_SYSTEM_PROMPT_TEMPLATES,
):
  | { ok: true; prompt: string; templateIndex: number | null }
  | { ok: false; error: string } {
  if (templates.length === 0) {
    return { ok: false, error: "no system prompt templates configured" };
  }

  if (param == null || param === "") {
    return { ok: true, prompt: templates[0].trim(), templateIndex: 0 };
  }

  let index: number | null = null;
  if (typeof param === "number" && Number.isInteger(param)) {
    index = param;
  } else {
    const s = String(param).trim();
    if (s === "") {
      return { ok: true, prompt: templates[0].trim(), templateIndex: 0 };
    }
    if (/^\d+$/.test(s)) index = parseInt(s, 10);
    else return { ok: true, prompt: s, templateIndex: null };
  }

  if (index !== null) {
    if (index < 0 || index >= templates.length) {
      return {
        ok: false,
        error: `system_prompt index ${index} out of range (0–${templates.length - 1})`,
      };
    }
    return { ok: true, prompt: templates[index].trim(), templateIndex: index };
  }

  return { ok: true, prompt: String(param).trim(), templateIndex: null };
}

// Initialize router
const router = new Router();

// API Routes
router
  .get("/", async (context) => {
    context.response.body = `Hello from Psy ChatBot Server`;
  })
  .get("/health", (context) => {
    // Health check endpoint
    context.response.body = {
      status: "healthy",
      timestamp: new Date().toISOString(),
    };
  })
  .get("/docs", async (context) => {
    const spec = resolveDocFile(context.request.url.searchParams);
    if (!spec.ok) {
      context.response.status = 400;
      context.response.body = { error: spec.error };
      return;
    }
    try {
      const readmeText = await Deno.readTextFile(spec.filePath);
      context.response.headers.set("Content-Type", "text/markdown; charset=utf-8");
      context.response.body = readmeText;
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        context.response.status = 404;
        context.response.body = { error: "documentation file not found", doc: spec.title };
        return;
      }
      console.error("Error reading doc:", err);
      context.response.status = 500;
      context.response.body = { error: "Could not load documentation" };
    }
  })
  .get("/docs/html", async (context) => {
    const spec = resolveDocFile(context.request.url.searchParams);
    if (!spec.ok) {
      context.response.status = 400;
      context.response.body = { error: spec.error };
      return;
    }
    try {
      const readmeText = await Deno.readTextFile(spec.filePath);

      // Render markdown to HTML with GFM styles
      const body = render(readmeText);

      // Create complete HTML document with GFM CSS
      const html = `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${spec.title} — API Documentation</title>
      <style>
        ${CSS}
        body {
          max-width: 900px;
          margin: 0 auto;
          padding: 20px;
        }
      </style>
    </head>
    <body>
    ${body}
    </body>
    </html>`;

      // Set response headers for HTML
      context.response.headers.set("Content-Type", "text/html; charset=utf-8");
      context.response.body = html;
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        context.response.status = 404;
        context.response.body = { error: "documentation file not found", doc: spec.title };
        return;
      }
      console.error("Error reading doc:", err);
      context.response.status = 500;
      context.response.body = { error: "Could not load documentation" };
    }
  })
  .post("/api/chat", async (context) => {
    const body = await context.request.body({ type: "json" }).value;
    const messages = body.messages;
    if (!messages || !Array.isArray(messages)) {
      context.response.status = 400;
      context.response.body = { error: "messages array is required" };
      return;
    }

    try {
      const text = await callLLM(messages);
      context.response.body = { text };
    } catch (err) {
      console.error("Chat API error:", err);
      context.response.status = 500;
      context.response.body = { error: String(err) };
    }
  })
  .post("/api/trans_cantonese", async (context) => {
    // Cantonese audio via OpenRouter STT (/v1/audio/transcriptions); translate uses chat completions fallback.
    // Request: multipart/form-data with:
    // - file: audio file (required)
    // - language: optional (default "yue")
    // - prompt: optional
    // - task: optional ("transcribe" | "translate")
    try {
      const body = context.request.body({ type: "form-data" });
      // Oak default maxSize is 0 → all files go to Deno.makeTempDir() (fails on Deno Deploy: NotSupported: tmpdir).
      // Set maxSize === maxFileSize so the whole upload stays in FormDataFile.content (in-memory only).
      const maxAudioBytes = 25 * 1024 * 1024; // 25MB
      const form = await body.value.read({
        maxFileSize: maxAudioBytes,
        maxSize: maxAudioBytes,
      });

      const fileField = form.files?.find((f) => f.name === "file") ?? form.files?.[0];
      if (!fileField) {
        context.response.status = 400;
        context.response.body = { error: "multipart field 'file' is required" };
        return;
      }

      // Oak may provide either a temporary filepath or raw content.
      let fileBytes: Uint8Array;
      if (fileField.content) {
        fileBytes = fileField.content;
      } else if (fileField.filename) {
        // If Oak wrote a temp file, it is exposed as `filename`? (varies by Oak version/config).
        // Prefer `tempfile` if present; otherwise try `filename` as a path.
        const path = (fileField as unknown as { tempfile?: string }).tempfile ?? fileField.filename;
        fileBytes = await Deno.readFile(path);
      } else {
        context.response.status = 400;
        context.response.body = { error: "could not read uploaded file" };
        return;
      }

      const filename = fileField.originalName ?? "audio";
      const mimeType = fileField.contentType ?? "application/octet-stream";
      // Ensure we pass an ArrayBuffer-backed BlobPart (avoid SharedArrayBuffer typing issues)
      const arrayBuffer: ArrayBuffer = Uint8Array.from(fileBytes).buffer;
      const file = new File([arrayBuffer], filename, { type: mimeType });

      const languageRaw = form.fields?.language ?? "yue";
      const prompt = form.fields?.prompt;
      const taskRaw = form.fields?.task;
      const task = taskRaw === "translate" ? "translate" : "transcribe";

      const text = await transcribeCantoneseAudio({
        file,
        filename,
        language: String(languageRaw || "").trim() || "yue",
        prompt: prompt ? String(prompt) : undefined,
        task,
      });

      context.response.body = { text };
    } catch (err) {
      console.error("trans_cantonese error:", err);
      context.response.status = 500;
      context.response.body = { error: String(err) };
    }
  })
  .get("/api/search", async (context) => {
    // TF-IDF search endpoint
    // Usage: GET /api/search?q=藏传佛教如何看待死亡&topk=10&lib=tfidf
    await ensureTfidfLoaded();
    const params = context.request.url.searchParams;
    const q = params.get("q") || "";
    const lib = params.get("lib") || "";
    const topk = Math.min(Math.max(parseInt(params.get("topk") || "10", 10) || 10, 1), 50);

    if (!lib.trim()) {
      context.response.status = 400;
      context.response.body = {
        error: "query parameter 'lib' is required",
        available: [...tfidfIndices.keys()],
      };
      return;
    }

    const index = tfidfIndices.get(lib);
    if (!index) {
      context.response.status = 404;
      context.response.body = {
        error: `lib "${lib}" not found`,
        available: [...tfidfIndices.keys()],
      };
      return;
    }

    if (!q.trim()) {
      context.response.status = 400;
      context.response.body = { error: "query parameter 'q' is required" };
      return;
    }

    const results = index.query(q, topk);
    context.response.body = {
      query: q,
      lib,
      topk,
      total_chunks: index.chunks.length,
      results,
    };
  })
  .get("/api/vector_search", async (context) => {
    // Supabase pgvector semantic search
    // Usage: GET /api/vector_search?q=如何面对焦虑&topk=10&lib=psy
    const params = context.request.url.searchParams;
    const q = params.get("q") || "";
    const lib = (params.get("lib") || "psy").trim();
    const topk = Math.min(Math.max(parseInt(params.get("topk") || "10", 10) || 10, 1), 50);

    if (!q.trim()) {
      context.response.status = 400;
      context.response.body = { error: "query parameter 'q' is required" };
      return;
    }

    try {
      const results = await vectorSearch(q, topk, lib);
      context.response.body = {
        query: q,
        lib,
        topk,
        results: results.map((r, i) => ({
          rank: i + 1,
          similarity: +r.similarity.toFixed(4),
          text: r.embedding_input,
          resource_name: r.source_name ?? undefined,
        })),
      };
    } catch (err) {
      console.error("vector_search error:", err);
      context.response.status = 500;
      context.response.body = { error: String(err) };
    }
  })
  /*

    # default template [0]
    curl -X POST http://localhost:8000/api/search_and_chat \
      -H "Content-Type: application/json" \
      -d '{"q": "如何面对焦虑", "search_mode": "vector"}'
    # built-in template [1]
    curl -X POST http://localhost:8000/api/search_and_chat \
      -H "Content-Type: application/json" \
      -d '{"q": "如何面对焦虑", "search_mode": "vector", "lib": "dao", "system_prompt": 1}'
    # custom string (unchanged 8000)
    curl -X POST http://localhost:4403/api/search_and_chat \
      -H "Content-Type: application/json" \
      -d '{"q": "如何面对焦虑", "system_prompt": "你是专业心理咨询师……"}'

  */
  .post("/api/search_and_chat", async (context) => {
    // RAG endpoint: search for relevant chunks then ask the LLM
    // Body: { q, lib?, topk?, messages?, search_mode?: "tfidf" | "vector", system_prompt?: string | number }
    const body = await context.request.body({ type: "json" }).value;
    const q: string = body.q || "";
    const topk: number = Math.min(Math.max(Number(body.topk) || 10, 1), 50);
    const searchMode: string = body.search_mode || "tfidf";
    const lib: string = String(
      body.lib ?? (searchMode === "vector" ? "psy" : ""),
    ).trim();
    const systemPromptParam: unknown =
      body.system_prompt ?? body.systemPrompt ?? null;

    if (!q.trim()) {
      context.response.status = 400;
      context.response.body = { error: "'q' is required" };
      return;
    }

    try {
      // Step 1: retrieve relevant context based on search_mode
      let contextChunks: string;
      let sources: unknown[];

      if (searchMode === "vector") {
        console.log("vector way search");
        // Supabase pgvector semantic search (lib defaults to "psy")
        const results = await vectorSearch(q, topk, lib);
        console.log("results", results);
        sources = results.map((r, i) => ({
          rank: i + 1,
          score: +r.similarity.toFixed(4),
          text: r.embedding_input,
          resource_name: r.source_name ?? undefined,
        }));
        contextChunks = results
          .map((r, i) => `[vector result #${i + 1}, similarity ${r.similarity.toFixed(4)}]\n${r.embedding_input}\nSource: ${r.source_name}`)
          .join("\n\n---\n\n");
        console.log("vector search results:", contextChunks);
      } else {
        console.log("tfidf way search");
        // TF-IDF sparse search (requires lib)
        await ensureTfidfLoaded();
        if (!lib.trim()) {
          context.response.status = 400;
          context.response.body = {
            error: "'lib' is required for tfidf search mode",
            available: [...tfidfIndices.keys()],
          };
          return;
        }
        const index = tfidfIndices.get(lib);
        if (!index) {
          context.response.status = 404;
          context.response.body = {
            error: `lib "${lib}" not found`,
            available: [...tfidfIndices.keys()],
          };
          return;
        }

        const searchResults = index.query(q, topk);
        sources = searchResults;
        contextChunks = searchResults
          .map(
            (r) =>
              `[${r.chunk.chapter_title} | ${r.chunk.href} chunk#${r.chunk.chunk_index}]\n${r.chunk.text}`,
          )
          .join("\n\n---\n\n");
        console.log("tfidf search results:", contextChunks);
      }

      // Step 2: build RAG messages
      const promptResolved = resolveSystemPrompt(systemPromptParam);
      if (!promptResolved.ok) {
        context.response.status = 400;
        context.response.body = {
          error: promptResolved.error,
          available_templates: DEFAULT_SYSTEM_PROMPT_TEMPLATES.length,
        };
        return;
      }
      const systemPrompt = promptResolved.prompt;

      console.log("systemPrompt:", systemPrompt);

      const citations = `
      下面是可作为背景知识的资料：
      【资料】
      ${contextChunks}
      `;

      const priorMessages: Array<{ role: string; content: string }> =
        Array.isArray(body.messages) ? body.messages : [];

      const messages = [
        { role: "system", content: systemPrompt },
        { role: "system", content: citations },
        ...priorMessages,
        { role: "user", content: q },
      ];

      console.log("messages:", messages);

      // Step 3: call LLM via OpenRouter
      const text = await callLLM(messages);

      context.response.body = {
        text,
        sources,
        ...(promptResolved.templateIndex !== null
          ? { system_prompt_template_index: promptResolved.templateIndex }
          : {}),
      };
    } catch (err) {
      console.error("search_and_chat error:", err);
      context.response.status = 500;
      context.response.body = { error: String(err) };
    }
  })
  .post("/api/new_cert", async (context) => {
    // Create a new certificate record in agent_lib_cert_master.
    // Body: { passwd, owner, cert_name }
    const body = await context.request.body({ type: "json" }).value;
    const { passwd, owner, cert_name } = body;

    const expectedPasswd = Deno.env.get("PASSWD") || "";
    if (!passwd || passwd !== expectedPasswd) {
      context.response.status = 401;
      context.response.body = { error: "Unauthorized: invalid passwd" };
      return;
    }

    if (!owner?.trim() || !cert_name?.trim()) {
      context.response.status = 400;
      context.response.body = { error: "'owner' and 'cert_name' are required" };
      return;
    }

    if (!supabase) {
      context.response.status = 500;
      context.response.body = { error: "Supabase not configured" };
      return;
    }

    try {
      const { data, error } = await supabase
        .from("agent_lib_cert_master")
        .insert({ owner: owner.trim(), cert_name: cert_name.trim() })
        .select()
        .single();

      if (error) throw error;

      context.response.body = { success: true, data };
    } catch (err) {
      console.error("new_cert error:", err);
      context.response.status = 500;
      context.response.body = { error: String(err) };
    }
  })
  .get("/api/verify_cert", async (context) => {
    // Verify cert by query param cert_id (row id in agent_lib_cert_master).
    const params = context.request.url.searchParams;
    const certId = (params.get("cert_id") || "").trim();

    if (!certId) {
      context.response.status = 400;
      context.response.body = { error: "query parameter 'cert_id' is required" };
      return;
    }

    if (!supabase) {
      context.response.status = 500;
      context.response.body = { error: "Supabase not configured" };
      return;
    }

    try {
      const { data, error } = await supabase
        .from("agent_lib_cert_master")
        .select("*")
        .eq("cert_id", certId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        context.response.status = 404;
        context.response.body = { error: "certificate not found", cert_id: certId };
        return;
      }

      context.response.body = { valid: true, cert: data };
    } catch (err) {
      console.error("verify_cert error:", err);
      context.response.status = 500;
      context.response.body = { error: String(err) };
    }
  });

// Initialize application
const app = new Application();

// Middleware: Error handling
app.use(async (context, next) => {
  try {
    await next();
  } catch (err) {
    console.error("Error:", err);
    context.response.status = 500;
    context.response.body = {
      success: false,
      error: "Internal server error",
    };
  }
});

// Middleware: Logger
app.use(async (context, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${context.request.method} ${context.request.url} - ${ms}ms`);
});

// Enable CORS for All Routes
app.use(oakCors());

// Middleware: Router
app.use(router.routes());

// Start server
const port = 8000;

const isDeploy =
  Boolean(Deno.env.get("DENO_DEPLOYMENT_ID")) || Boolean(Deno.env.get("DENO_REGION"));

if (isDeploy) {
  console.info(`🚀 Server started (Deno Deploy)`);
  Deno.serve({
    handler: async (req) => {
      const resp = await app.handle(req);
      return resp ?? new Response("Not Found", { status: 404 });
    },
  });
} else {
  console.info(`
  🚀 CORS-enabled web server listening on port ${port}
  
  🌐 Visit: http://localhost:${port}
  `);

  await app.listen({ port });
}