const TTS_API = "https://api.lang-bot.aidimsum.com/api/tts_cantonese";

export type TtsVoice = "Kiki" | "Rocky";

export type TtsCantoneseResult = {
  text: string;
  voice: string;
  model: string;
  audio_url: string;
  expires_at?: number;
  request_id?: string;
};

/** 调用 Lang Bot `/api/tts_cantonese`，返回可播放的音频 URL。 */
export async function synthesizeCantoneseAudio(
  text: string,
  voice: TtsVoice = "Kiki",
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("请先输入跟读文本");

  const res = await fetch(TTS_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: trimmed,
      voice,
      language_type: "Chinese",
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const errBody = await res.json();
      detail = typeof errBody.error === "string" ? `: ${errBody.error}` : "";
    } catch {
      // ignore parse errors
    }
    throw new Error(`AI 生成音频失败 (${res.status})${detail}`);
  }

  const data = (await res.json()) as TtsCantoneseResult;
  const audioUrl = data.audio_url?.trim();
  if (!audioUrl) throw new Error("AI 未返回音频链接");
  return audioUrl;
}
