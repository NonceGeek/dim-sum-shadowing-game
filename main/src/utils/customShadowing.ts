export function buildCustomShadowingQuestion(text: string, audioUrl: string) {
  const trimmed = text.trim();
  return {
    content: trimmed,
    originalText: trimmed,
    yueText: trimmed,
    yueQuizText: `<div>${trimmed}</div>`,
    yueQuiz: [],
    yueQuizAnswer: [],
    audioUrl: audioUrl.trim(),
    skipJyutpingFetch: false,
  };
}

export function buildFreeShadowingShareUrl(
  st: string,
  audio: string,
  origin = typeof window !== "undefined" ? window.location.origin : "",
): string {
  const params = new URLSearchParams({ st: st.trim(), audio: audio.trim() });
  return `${origin}/free_shadowing/free?${params.toString()}`;
}
