"use client";
import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Footer from "@/components/Footer";
import Category from "@/components/Category";
import UserProfile from "@/components/UserProfile";
import FollowItemView from "@/components/FollowItemView";

const API_BASE = "https://backend.aidimsum.com";

function transformCorpusItemToQuestion(item: Record<string, unknown>) {
  const data = (item.data as string) || "";
  const note = (item.note as Record<string, unknown>) || {};
  const context = (note.context as Record<string, unknown>) || {};
  const structuredNote = (item.structured_note as Record<string, unknown>) || {};
  const blocks = (structuredNote.data as unknown[])?.[0] as Record<string, unknown>;
  const blockList = (blocks?.blocks as Record<string, unknown>[]) || [];
  const jyutping = (structuredNote.jyutping as string) || "";

  let audioUrl = (context.audio as string) || "";
  if (!audioUrl) {
    const audioBlock = blockList.find((b) => (b as Record<string, string>).type === "audio");
    audioUrl = ((audioBlock as Record<string, string>)?.url as string) || "";
  }

  let originalText = (context.粤语文本 as string) || (note.meaning as string[])?.[0] || "";
  if (!originalText) {
    const defBlock = blockList.find((b) => (b as Record<string, string>).type === "definition");
    originalText = ((defBlock as Record<string, string>)?.content as string) || "";
  }

  const jyutpingArr = jyutping ? jyutping.split(/\s+/) : [];
  let content = data;
  if (jyutpingArr.length > 0) {
    const chars = data.replace(/[。！？，、\s]/g, "").split("");
    let j = 0;
    content = data
      .split("")
      .map((c) => {
        if (/[。！？，、\s]/.test(c)) return c;
        const jp = jyutpingArr[j++];
        return jp ? `${c}(${jp})` : c;
      })
      .join("");
  }

  return {
    content,
    originalText: originalText || data,
    yueText: data,
    yueQuizText: `<div>${content}</div>`,
    yueQuiz: [],
    yueQuizAnswer: [],
    audioUrl,
  };
}

function FollowPageContent() {
  const searchParams = useSearchParams();
  const uuid = searchParams.get("uuid");
  const [item, setItem] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(!!uuid);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uuid) return;
    const url = `${API_BASE}/v2/corpus_item?unique_id=${encodeURIComponent(uuid)}`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data && Object.keys(data).length > 0) {
          setItem(data);
        } else {
          setError("未找到该语料");
        }
      })
      .catch((err) => {
        setError(err?.message || "加载失败");
      })
      .finally(() => setLoading(false));
  }, [uuid]);

  if (uuid) {
    if (loading) return <div className="p-8 text-center">加载中…</div>;
    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
    if (item) {
      const question = transformCorpusItemToQuestion(item);
      return (
        <div className="">
          <UserProfile />
          <FollowItemView questions={[question]} />
          <Footer />
        </div>
      );
    }
  }

  return (
    <div className="">
      <UserProfile />
      <p className="mt-5 ml-8">请选择场景并开始跟读！</p>
      <Category />
      <Footer />
    </div>
  );
}

export default function FollowPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">加载中…</div>}>
      <FollowPageContent />
    </Suspense>
  );
}
