"use client";
import React, { useState } from "react";
import Category from "@/components/Category";
import Footer from "@/components/Footer";
import UserProfile from "@/components/UserProfile";

const CORPUS_OPTIONS = [
  { value: "wanjui", label: "粤语万句多用途生活场景有声语料集" },
  // { value: "tongyao", label: "广府童谣" },
  { value: "gfxm1", label: "功夫熊猫1" },
] as const;

export default function HomePage() {
  const [corpusId, setCorpusId] = useState<(typeof CORPUS_OPTIONS)[number]["value"]>(
    CORPUS_OPTIONS[0].value
  );

  return (
    <div className="">
      <UserProfile />
      {/* A selector here: 切换语料集：粤语万句多用途生活场景有声语料集、广府童谣、 小猪佩奇粤语音频语料集*/}
      <div className="mt-5 mx-8 flex items-center justify-between">
        <p>请选择场景并开始游戏🌹</p>
        <div className="flex items-center gap-2">
          <label htmlFor="corpus-select" className="shrink-0 text-sm text-white">
            切换语料集：
          </label>
          <select
            id="corpus-select"
            className="max-w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-200"
            value={corpusId}
            onChange={(e) =>
              setCorpusId(e.target.value as (typeof CORPUS_OPTIONS)[number]["value"])
            }
          >
            {CORPUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {/* A link here with emoji index finger right to [AI DimSum 粤语语料库](https://search.aidimsum.com */}
      <p className="mt-3 ml-8 text-sm">
        了解更多？👉&nbsp;
        <a
          href="https://search.aidimsum.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-green-600 underline decoration-green-300 underline-offset-2 hover:text-green-700"
        >
          AI DimSum 粤语语料库
        </a>
      </p>
      <Category key={corpusId} corpusId={corpusId} />
      <Footer />
    </div>
  );
}
