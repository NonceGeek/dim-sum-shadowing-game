import ToJyutping from "npm:to-jyutping@3";
import { Context } from "https://deno.land/x/oak@v12.6.1/mod.ts";

export type JyutpingChar = {
  character: string;
  jyutping: string;
};

export type JyutpingResult = {
  text: string;
  jyutping: string;
  content: string;
  list: JyutpingChar[];
};

export function convertToJyutping(text: string): JyutpingResult {
  const trimmed = text.trim();
  const pairs = ToJyutping.getJyutpingList(trimmed) as Array<[string, string]>;
  const list = pairs.map(([character, jyutping]) => ({ character, jyutping }));

  return {
    text: trimmed,
    jyutping: ToJyutping.getJyutpingText(trimmed),
    content: ToJyutping.getJyutping(trimmed),
    list,
  };
}

async function readJsonBody(context: Context): Promise<Record<string, unknown> | null> {
  try {
    const body = await context.request.body({ type: "json" }).value;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      context.response.status = 400;
      context.response.body = { error: "JSON object body is required" };
      return null;
    }
    return body as Record<string, unknown>;
  } catch {
    context.response.status = 400;
    context.response.body = { error: "Invalid JSON body" };
    return null;
  }
}

/*
curl -X POST http://localhost:3003/api/to_jyutping \
  -H "Content-Type: application/json" \
  -d '{"text":"长老"}'

curl "http://localhost:3003/api/to_jyutping?text=长老"
*/
export async function handleToJyutping(context: Context) {
  try {
    let text = context.request.url.searchParams.get("text")?.trim() ?? "";

    if (!text && context.request.method === "POST") {
      const body = await readJsonBody(context);
      if (!body) return;
      text = typeof body.text === "string" ? body.text.trim() : "";
    }

    if (!text) {
      context.response.status = 400;
      context.response.body = { error: "'text' is required (JSON body or query param)" };
      return;
    }

    context.response.body = convertToJyutping(text);
  } catch (err) {
    console.error("to_jyutping error:", err);
    context.response.status = 500;
    context.response.body = { error: String(err) };
  }
}
