export type CustomShadowingMediaType = "audio" | "video";

export function buildCustomShadowingQuestion(
  text: string,
  mediaUrl: string,
  mediaType: CustomShadowingMediaType = "audio",
) {
  const trimmed = text.trim();
  const url = mediaUrl.trim();
  return {
    content: trimmed,
    originalText: trimmed,
    yueText: trimmed,
    yueQuizText: `<div>${trimmed}</div>`,
    yueQuiz: [],
    yueQuizAnswer: [],
    audioUrl: mediaType === "audio" ? url : undefined,
    videoUrl: mediaType === "video" ? url : undefined,
    skipJyutpingFetch: false,
  };
}

export function buildFreeShadowingShareUrl(
  st: string,
  media: string,
  mediaType: CustomShadowingMediaType = "audio",
  origin = typeof window !== "undefined" ? window.location.origin : "",
): string {
  const params = new URLSearchParams({ st: st.trim() });
  if (mediaType === "video") {
    params.set("video", media.trim());
    params.set("mode", "video");
  } else {
    params.set("audio", media.trim());
  }
  return `${origin}/free_shadowing/free?${params.toString()}`;
}
