const TRANS_API = `${process.env.NEXT_PUBLIC_API_URL}/api/transcribe`;

/** 将浏览器音频 Blob 转为 WAV，供转录 API 使用。 */
export async function convertBlobToWav(blob: Blob): Promise<Blob> {
  const audioCtx = new AudioContext();
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  await audioCtx.close();

  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  const bitDepth = 16;
  const blockAlign = numChannels * (bitDepth / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;

  const wavBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wavBuffer);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([wavBuffer], { type: "audio/wav" });
}

/** 调用 /api/transcribe，返回识别文本。 */
export async function transcribeAudioBlob(blob: Blob): Promise<string> {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) throw new Error("未配置 NEXT_PUBLIC_API_URL");

  const wavBlob = await convertBlobToWav(blob);
  const file = new File([wavBlob], "audio.wav", { type: "audio/wav" });
  const formData = new FormData();
  formData.append("file", file);
  formData.append("task", "transcribe");

  const res = await fetch(TRANS_API, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`转录请求失败: ${res.status}`);
  }

  const data = await res.json();
  return typeof data.text === "string" ? data.text.trim() : "";
}

/** 从音频 URL 拉取并转录（受 CORS 限制）。 */
export async function transcribeAudioUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("无法加载音频链接，请检查链接或改用本地上传");
  }
  return transcribeAudioBlob(await res.blob());
}
