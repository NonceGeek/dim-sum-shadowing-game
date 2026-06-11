"use client";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import FollowItemView from "@/components/FollowItemView";
import {
  fetchCorpusItemFromAny,
  transformCorpusItemToQuestion,
} from "@/utils/corpusItem";

function FreeShadowingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const uuidParam = searchParams.get("uuid")?.trim() ?? "";

  const [uuidInput, setUuidInput] = useState(uuidParam);
  const [fetchResult, setFetchResult] = useState<{
    item: Record<string, unknown>;
    source: "backend" | "wu";
  } | null>(null);
  const [loading, setLoading] = useState(!!uuidParam);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uuidParam) {
      setLoading(false);
      setFetchResult(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    fetchCorpusItemFromAny(uuidParam)
      .then(setFetchResult)
      .catch((err) => {
        setFetchResult(null);
        setError(err?.message || "加载失败");
      })
      .finally(() => setLoading(false));
  }, [uuidParam]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const uuid = uuidInput.trim();
    if (!uuid) return;
    router.push(`/free_shadowing?uuid=${encodeURIComponent(uuid)}`);
  };

  if (uuidParam) {
    if (loading) return <div className="p-8 text-center">加载中…</div>;
    if (error) {
      return (
        <div className="p-8 text-center text-red-400">
          <p>{error}</p>
          <button
            type="button"
            className="mt-4 text-green-200 underline"
            onClick={() => router.push("/free_shadowing")}
          >
            返回
          </button>
        </div>
      );
    }
    if (fetchResult) {
      const question = transformCorpusItemToQuestion(fetchResult.item, {
        skipJyutpingFetch: fetchResult.source === "wu",
      });
      return <FollowItemView questions={[question]} backHref="/free_shadowing" />;
    }
  }

  return (
    <div className="mx-8 mt-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-green-200">自由跟读</h1>
      <p className="mt-3 text-sm leading-relaxed text-white/80">
        在{" "}
        <a
          href="https://beta.search.aidimsum.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-green-400 underline decoration-green-500/50 underline-offset-2 hover:text-green-300"
        >
          AI DimSum 粤语语料库
        </a>{" "}
        找到含有音频的任意语料，复制其右上角的 ID 后粘贴到下方，点击「我要跟读」。
      </p>
      <p className="mt-3 text-sm leading-relaxed text-white/80">或者你想学习吴语，例如上海话？——&nbsp;
      <a
          href="https://wu.search.aidimsum.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-green-400 underline decoration-green-500/50 underline-offset-2 hover:text-green-300"
        >
          AI DimSum 吴语语料库
        </a>{" "}
      </p>
      <img
        src="/copy_uuid.png"
        alt="在语料库页面复制右上角 UUID 的示意"
        className="mt-4 w-full rounded-lg border border-white/10 shadow-sm"
      />
      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={uuidInput}
          onChange={(e) => setUuidInput(e.target.value)}
          placeholder="粘贴语料 UUID"
          className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-200"
        />
        <button
          type="submit"
          className="rounded-lg border border-green-200/60 px-4 py-2 text-sm text-green-200 transition hover:bg-green-200/10"
        >
          我要跟读！
        </button>
      </form>
      <p className="mt-3 text-sm leading-relaxed text-white/80">
        一些例子：
      </p>
      <p className="mt-3 text-sm leading-relaxed text-white/80">
        * 「功夫熊猫1 」台词：c48f3f34-03f8-4045-87b7-2ad48e06d161
      </p>
      <p className="mt-3 text-sm leading-relaxed text-white/80">
        * 「大圣归来 」台词：3f3b4279-de11-4536-9464-c7da505424b3
      </p>
      <p className="mt-3 text-sm leading-relaxed text-white/80">
        * 「落花流水」歌词：8db02d26-598f-436f-9eae-9db680cee90b
      </p>
      <br /><br />
      <p className="mt-3 text-sm leading-relaxed text-white/80">
        一些吴语的例子：
      </p>
      <p className="mt-3 text-sm leading-relaxed text-white/80">
        * "侬是小明对伐"：fcf2c32b-2de2-4fe6-b6cf-714ff61886c8
      </p>
      <p className="mt-3 text-sm leading-relaxed text-white/80">
        * "工作老忙额，还要自学英文"：b55daabc-a46b-435a-9127-e665edbe9748
      </p>
      <br /><br />
    </div>
  );
}

export default function FreeShadowingPage() {
  return (
    <div>
      <Header />
      <Suspense fallback={<div className="p-8 text-center">加载中…</div>}>
        <FreeShadowingContent />
      </Suspense>
      <Footer />
    </div>
  );
}
