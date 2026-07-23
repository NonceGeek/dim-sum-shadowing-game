"use client";
import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import FollowItemView from "@/components/FollowItemView";
import { buildCustomShadowingQuestion, type CustomShadowingMediaType } from "@/utils/customShadowing";
import { transcribeAudioBlob, transcribeAudioUrl, transcribeVideoBlob, transcribeVideoUrl } from "@/utils/transcribeApi";
import { synthesizeCantoneseAudio, type TtsVoice } from "@/utils/ttsApi";

type AudioMode = "upload" | "link" | "tts";
type VideoMode = "upload" | "link";
type ShadowingMode = CustomShadowingMediaType;

function readTextParam(searchParams: URLSearchParams): string {
  return (searchParams.get("st") ?? searchParams.get("text"))?.trim() ?? "";
}

function readShadowingMode(searchParams: URLSearchParams): ShadowingMode {
  if (searchParams.get("mode") === "video" || searchParams.get("video")) {
    return "video";
  }
  return "audio";
}

function buildFreeShadowingUrl(
  st: string,
  media?: string,
  shadowingMode: ShadowingMode = "audio",
): string {
  const params = new URLSearchParams({ st });
  if (media) {
    if (shadowingMode === "video") {
      params.set("video", media);
      params.set("mode", "video");
    } else {
      params.set("audio", media);
    }
  }
  return `/free_shadowing/free?${params.toString()}`;
}

function FreeShadowingFreeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const textParam = readTextParam(searchParams);
  const audioParam = searchParams.get("audio")?.trim() ?? "";
  const videoParam = searchParams.get("video")?.trim() ?? "";
  const urlShadowingMode = readShadowingMode(searchParams);

  const [shadowingMode, setShadowingMode] = useState<ShadowingMode>("audio");
  const [textInput, setTextInput] = useState(textParam);
  const [audioMode, setAudioMode] = useState<AudioMode>("upload");
  const [videoMode, setVideoMode] = useState<VideoMode>("upload");
  const [audioLinkInput, setAudioLinkInput] = useState(audioParam);
  const [videoLinkInput, setVideoLinkInput] = useState(videoParam);
  const [ttsVoice, setTtsVoice] = useState<TtsVoice>("Kiki");
  const [sessionQuestion, setSessionQuestion] = useState<ReturnType<
    typeof buildCustomShadowingQuestion
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [videoRecognizeProgress, setVideoRecognizeProgress] = useState("");
  const [generatingTts, setGeneratingTts] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  const questionFromUrl =
    textParam && (audioParam || videoParam)
      ? buildCustomShadowingQuestion(
          textParam,
          videoParam || audioParam,
          urlShadowingMode,
        )
      : null;
  const question = sessionQuestion ?? questionFromUrl;
  const hasUrlParams = [...searchParams.keys()].length > 0;

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const text = textInput.trim();
    if (!text) {
      setError("请输入跟读文本");
      return;
    }

    if (shadowingMode === "video") {
      if (videoMode === "link") {
        const videoUrl = videoLinkInput.trim();
        if (!videoUrl) {
          setError("请输入视频链接");
          return;
        }
        router.push(buildFreeShadowingUrl(text, videoUrl, "video"));
        return;
      }

      const file = videoInputRef.current?.files?.[0];
      if (!file) {
        setError("请上传视频文件");
        return;
      }

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;
      setSessionQuestion(buildCustomShadowingQuestion(text, url, "video"));
      router.replace(buildFreeShadowingUrl(text, undefined, "video"), { scroll: false });
      return;
    }

    if (audioMode === "link" || audioMode === "tts") {
      const audioUrl = audioLinkInput.trim();
      if (!audioUrl) {
        setError(audioMode === "tts" ? "请先生成 AI 声音文件" : "请输入音频链接");
        return;
      }
      router.push(buildFreeShadowingUrl(text, audioUrl, "audio"));
      return;
    }

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("请上传音频文件");
      return;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setSessionQuestion(buildCustomShadowingQuestion(text, url, "audio"));
    router.replace(buildFreeShadowingUrl(text, undefined, "audio"), { scroll: false });
  };

  const handleRecognizeText = async () => {
    setError(null);
    setRecognizing(true);
    try {
      let text: string;
      if (audioMode === "upload") {
        const file = fileInputRef.current?.files?.[0];
        if (!file) {
          setError("请先上传音频文件");
          return;
        }
        text = await transcribeAudioBlob(file);
      } else {
        const audioUrl = audioLinkInput.trim();
        if (!audioUrl) {
          setError("请先输入音频链接");
          return;
        }
        text = await transcribeAudioUrl(audioUrl);
      }

      if (!text) {
        setError("未能识别出文本");
        return;
      }
      setTextInput(text);
    } catch (err) {
      console.error("识别音频文本失败:", err);
      setError(err instanceof Error ? err.message : "识别失败");
    } finally {
      setRecognizing(false);
    }
  };

  const handleRecognizeVideoText = async () => {
    setError(null);
    setRecognizing(true);
    setVideoRecognizeProgress("正在准备…");
    const reportProgress = (message: string) => setVideoRecognizeProgress(message);
    try {
      let text: string;
      if (videoMode === "upload") {
        const file = videoInputRef.current?.files?.[0];
        if (!file) {
          setError("请先上传视频文件");
          return;
        }
        text = await transcribeVideoBlob(file, { onProgress: reportProgress });
      } else {
        const videoUrl = videoLinkInput.trim();
        if (!videoUrl) {
          setError("请先输入视频链接");
          return;
        }
        text = await transcribeVideoUrl(videoUrl, { onProgress: reportProgress });
      }

      if (!text) {
        setError("未能识别出文本");
        return;
      }
      setTextInput(text);
    } catch (err) {
      console.error("识别视频文本失败:", err);
      setError(err instanceof Error ? err.message : "识别失败");
    } finally {
      setRecognizing(false);
      setVideoRecognizeProgress("");
    }
  };

  const textInputField = (
    <label className="flex flex-col gap-1.5 text-sm text-white/80">
      跟读文本
      <textarea
        value={textInput}
        onChange={(e) => setTextInput(e.target.value)}
        placeholder="输入要跟读的原文，例如：行路唔好睇手机吖"
        rows={3}
        className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-200"
      />
    </label>
  );

  const handleGenerateTts = async () => {
    setError(null);
    setGeneratingTts(true);
    try {
      const audioUrl = await synthesizeCantoneseAudio(textInput, ttsVoice);
      setAudioLinkInput(audioUrl);
    } catch (err) {
      console.error("AI 生成音频失败:", err);
      setError(err instanceof Error ? err.message : "AI 生成音频失败");
    } finally {
      setGeneratingTts(false);
    }
  };

  if (hasUrlParams) {
    if (question) {
      return (
        <FollowItemView questions={[question]} backHref="/free_shadowing/free" />
      );
    }

    return (
      <div className="mx-8 mt-6 max-w-2xl p-8 text-center">
        <p className="text-red-400">
          链接参数不完整：需要跟读文本（st）和音频链接（audio）或视频链接（video）。
        </p>
        <a
          href="/free_shadowing/free"
          className="mt-4 inline-block text-green-200 underline"
        >
          返回设置
        </a>
      </div>
    );
  }

  return (
    <div className="mx-8 mt-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-green-200">超自由跟读</h1>

      <fieldset className="mt-4 flex flex-col gap-2 text-sm text-white/80 sm:flex-row sm:gap-4">
        <legend className="sr-only">跟读模式</legend>
        <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-white/20 px-4 py-3 transition hover:border-green-200/50">
          <input
            type="radio"
            name="shadowingMode"
            checked={shadowingMode === "audio"}
            onChange={() => setShadowingMode("audio")}
          />
          <span>
            <span className="block font-medium text-green-200">基于音频跟读</span>
            <span className="mt-0.5 block text-xs text-white/60">
              上传音频、粘贴链接，或用 AI 生成粤语声音
            </span>
          </span>
        </label>
        <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-white/20 px-4 py-3 transition hover:border-green-200/50">
          <input
            type="radio"
            name="shadowingMode"
            checked={shadowingMode === "video"}
            onChange={() => setShadowingMode("video")}
          />
          <span>
            <span className="block font-medium text-green-200">基于视频跟读</span>
            <span className="mt-0.5 block text-xs text-white/60">
              上传视频或粘贴链接，边看边跟读
            </span>
          </span>
        </label>
      </fieldset>

      <p className="mt-3 text-sm leading-relaxed text-white/80">
        {shadowingMode === "audio"
          ? "自行输入跟读文本，并上传音频、粘贴音频链接，或用 AI 生成粤语声音，即可开始跟读练习。"
          : "自行输入跟读文本，并上传视频或粘贴视频链接，播放参考视频后进行跟读练习。"}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-white/60">
        {shadowingMode === "audio"
          ? "使用音频链接或 AI 生成音频提交后，可通过 URL 分享本页；上传本地文件仅在当前浏览器会话内有效。AI 音频链接约 24 小时内有效。"
          : "上传本地视频仅在当前浏览器会话内有效。"}
      </p>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
        {shadowingMode === "audio" && textInputField}

        <fieldset className="flex flex-col gap-2 text-sm text-white/80">
          <legend className="mb-1">
            {shadowingMode === "audio" ? "音频来源" : "视频来源"}
          </legend>
          {shadowingMode === "audio" ? (
            <>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="audioMode"
                  checked={audioMode === "upload"}
                  onChange={() => setAudioMode("upload")}
                />
                上传本地音频
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="audioMode"
                  checked={audioMode === "link"}
                  onChange={() => setAudioMode("link")}
                />
                粘贴音频链接
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="audioMode"
                  checked={audioMode === "tts"}
                  onChange={() => setAudioMode("tts")}
                />
                AI 生成声音文件
              </label>
            </>
          ) : (
            <>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="videoMode"
                  checked={videoMode === "upload"}
                  onChange={() => setVideoMode("upload")}
                />
                上传本地视频
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="videoMode"
                  checked={videoMode === "link"}
                  onChange={() => setVideoMode("link")}
                />
                粘贴视频链接
              </label>
            </>
          )}
        </fieldset>

        {shadowingMode === "audio" ? (
          audioMode === "upload" ? (
            <label className="flex flex-col gap-1.5 text-sm text-white/80">
              音频文件
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm"
                className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm file:mr-3 file:rounded file:border-0 file:bg-green-100 file:px-3 file:py-1 file:text-sm file:text-green-900"
              />
            </label>
          ) : audioMode === "link" ? (
            <label className="flex flex-col gap-1.5 text-sm text-white/80">
              音频链接
              <input
                type="url"
                value={audioLinkInput}
                onChange={(e) => setAudioLinkInput(e.target.value)}
                placeholder="https://example.com/audio.mp3"
                className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-200"
              />
            </label>
          ) : (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 text-sm text-white/80">
                音色
                <select
                  value={ttsVoice}
                  onChange={(e) => setTtsVoice(e.target.value as TtsVoice)}
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-200"
                >
                  <option value="Kiki">Kiki（粤语女声）</option>
                  <option value="Rocky">Rocky（粤语男声）</option>
                </select>
              </label>
              <button
                type="button"
                onClick={handleGenerateTts}
                disabled={generatingTts || !textInput.trim()}
                className="self-start rounded-lg border border-green-200/60 px-4 py-2 text-sm text-green-200 transition hover:bg-green-200/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generatingTts ? "生成中…" : "根据跟读文本生成声音"}
              </button>
              <label className="flex flex-col gap-1.5 text-sm text-white/80">
                生成的音频链接
                <input
                  type="url"
                  value={audioLinkInput}
                  onChange={(e) => setAudioLinkInput(e.target.value)}
                  placeholder="生成后会自动填入音频链接"
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-200"
                />
              </label>
              {audioLinkInput.trim() && (
                <audio
                  controls
                  preload="none"
                  src={audioLinkInput.trim()}
                  className="w-full max-w-md"
                />
              )}
            </div>
          )
        ) : videoMode === "upload" ? (
          <label className="flex flex-col gap-1.5 text-sm text-white/80">
            视频文件
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*,.mp4,.webm,.mov,.m4v"
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm file:mr-3 file:rounded file:border-0 file:bg-green-100 file:px-3 file:py-1 file:text-sm file:text-green-900"
            />
          </label>
        ) : (
          <label className="flex flex-col gap-1.5 text-sm text-white/80">
            视频链接
            <input
              type="url"
              value={videoLinkInput}
              onChange={(e) => setVideoLinkInput(e.target.value)}
              placeholder="https://example.com/video.mp4"
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-200"
            />
            {videoLinkInput.trim() && (
              <video
                controls
                playsInline
                preload="metadata"
                src={videoLinkInput.trim()}
                className="mt-2 w-full max-w-md rounded-lg"
              />
            )}
          </label>
        )}

        {shadowingMode === "video" && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleRecognizeVideoText}
                disabled={recognizing}
                className="rounded-lg border border-green-200/60 px-4 py-2 text-sm text-green-200 transition hover:bg-green-200/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                识别视频语音，自动填入跟读文本
              </button>
              {recognizing && videoRecognizeProgress && (
                <span
                  className="text-sm text-green-200/90"
                  aria-live="polite"
                >
                  {videoRecognizeProgress}
                </span>
              )}
            </div>
            {textInputField}
          </>
        )}

        {shadowingMode === "audio" && audioMode === "upload" && (
          <button
            type="button"
            onClick={handleRecognizeText}
            disabled={recognizing}
            className="self-start rounded-lg border border-green-200/60 px-4 py-2 text-sm text-green-200 transition hover:bg-green-200/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {recognizing ? "识别中…" : "识别音频内容，自动填入跟读文本"}
          </button>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          className="self-start rounded-lg border border-green-200/60 px-4 py-2 text-sm text-green-200 transition hover:bg-green-200/10"
        >
          我要跟读！
        </button>
      </form>

      <p className="mt-6 text-sm text-white/50">
        <a
          href="/free_shadowing"
          className="text-green-400 underline decoration-green-500/50 underline-offset-2 hover:text-green-300"
        >
          返回语料库自由跟读
        </a>
      </p>
      <br />
      <br />
    </div>
  );
}

export default function FreeShadowingFreePage() {
  return (
    <div>
      <Header />
      <Suspense fallback={<div className="p-8 text-center">加载中…</div>}>
        <FreeShadowingFreeContent />
      </Suspense>
      <Footer />
    </div>
  );
}
