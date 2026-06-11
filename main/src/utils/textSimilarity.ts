function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const prev = Array.from({ length: n + 1 }, (_, j) => j);
  const curr = new Array<number>(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost,
      );
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }

  return prev[n];
}

/** 比较前完全忽略标点符号与空白，不参与相似度计算。 */
function normalizeForSimilarity(text: string): string {
  return text.trim().replace(/[\p{P}\s]/gu, "");
}

/** Returns 0–100 similarity based on normalized Levenshtein distance. */
export function calculateTextSimilarity(text1: string, text2: string): number {
  const a = normalizeForSimilarity(text1);
  const b = normalizeForSimilarity(text2);

  if (!a && !b) return 100;
  if (!a || !b) return 0;

  const distance = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return Math.round((1 - distance / maxLen) * 100);
}
