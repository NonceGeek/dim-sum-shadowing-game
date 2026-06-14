"use client";
import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import FollowItemView from "@/components/FollowItemView";
import { buildCustomShadowingQuestion } from "@/utils/customShadowing";
import { transcribeAudioBlob, transcribeAudioUrl } from "@/utils/transcribeApi";

type AudioMode = "upload" | "link";

function readTextParam(searchParams: URLSearchParams): string {
  return (searchParams.get("st") ?? searchParams.get("text"))?.trim() ?? "";
}

function buildFreeShadowingUrl(st: string, audio?: string): string {
  const params = new URLSearchParams({ st });
  if (audio) params.set("audio", audio);
  return `/free_shadowing/free?${params.toString()}`;
}

function FreeShadowingFreeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const textParam = readTextParam(searchParams);
  const audioParam = searchParams.get("audio")?.trim() ?? "";

  const [textInput, setTextInput] = useState(textParam);
  const [audioMode, setAudioMode] = useState<AudioMode>("upload");
  const [audioLinkInput, setAudioLinkInput] = useState(audioParam);
  const [sessionQuestion, setSessionQuestion] = useState<ReturnType<
    typeof buildCustomShadowingQuestion
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recognizing, setRecognizing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  const questionFromUrl =
    textParam && audioParam
      ? buildCustomShadowingQuestion(textParam, audioParam)
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

    if (audioMode === "link") {
      const audioUrl = audioLinkInput.trim();
      if (!audioUrl) {
        setError("请输入音频链接");
        return;
      }
      router.push(buildFreeShadowingUrl(text, audioUrl));
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
    setSessionQuestion(buildCustomShadowingQuestion(text, url));
    router.replace(buildFreeShadowingUrl(text), { scroll: false });
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

  if (hasUrlParams) {
    if (question) {
      return (
        <FollowItemView questions={[question]} backHref="/free_shadowing/free" />
      );
    }

    return (
      <div className="mx-8 mt-6 max-w-2xl p-8 text-center">
        <p className="text-red-400">
          链接参数不完整：需要跟读文本（st）和音频链接（audio）。
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
      <p className="mt-3 text-sm leading-relaxed text-white/80">
        自行输入跟读文本，并上传音频或粘贴音频链接，即可开始跟读练习。
      </p>
      <p className="mt-2 text-sm leading-relaxed text-white/60">
        使用音频链接提交后，可通过 URL 分享本页；上传本地文件仅在当前浏览器会话内有效。
      </p>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
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

        <fieldset className="flex flex-col gap-2 text-sm text-white/80">
          <legend className="mb-1">音频来源</legend>
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
        </fieldset>

        {audioMode === "upload" ? (
          <label className="flex flex-col gap-1.5 text-sm text-white/80">
            音频文件
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm"
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm file:mr-3 file:rounded file:border-0 file:bg-green-100 file:px-3 file:py-1 file:text-sm file:text-green-900"
            />
          </label>
        ) : (
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
        )}

        {audioMode === "upload" && (
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
