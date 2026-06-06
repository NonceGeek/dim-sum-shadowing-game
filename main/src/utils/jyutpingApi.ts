export async function fetchJyutpingContent(text: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return trimmed;

  const res = await fetch(`${base}/api/to_jyutping`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: trimmed }),
  });

  if (!res.ok) return trimmed;

  const data = await res.json();
  return typeof data.content === "string" && data.content ? data.content : trimmed;
}
