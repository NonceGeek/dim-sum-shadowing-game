"use client";
import { useState, useRef, useEffect } from "react";
import { IoVolumeMediumSharp } from "react-icons/io5";
import { useRouter } from "next/navigation";
import Game from "@/components/Game";
import { useQuestionStore } from "@/stores/questionStore";
import classNames from "classnames";
import { fetchJyutpingContent } from "@/utils/jyutpingApi";

interface Question {
  content?: string;
  originalText?: string;
  yueText?: string;
  audioUrl?: string;
  skipJyutpingFetch?: boolean;
}

export default function FollowItemView({
  questions,
  backHref = "/",
}: {
  questions: Question[];
  backHref?: string;
}) {
  const router = useRouter();
  const [quesNumber, setQuesNumber] = useState(0);
  const [isAudoSlowSpeed, setIsAudoSlowSpeed] = useState(false);
  const [hasResult, setResult] = useState(false);
  const [displayContent, setDisplayContent] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);
  const { setCurrentQuestion } = useQuestionStore();

  useEffect(() => {
    setCurrentQuestion(questions[quesNumber] ?? null);
  }, [questions, quesNumber, setCurrentQuestion]);

  useEffect(() => {
    const q = questions[quesNumber];
    if (!q) {
      setDisplayContent("");
      return;
    }

    const sourceText = q.yueText?.trim() || q.content?.trim() || "";
    setDisplayContent(q.content ?? sourceText);

    if (!sourceText || q.skipJyutpingFetch) return;

    let cancelled = false;
    fetchJyutpingContent(q.yueText?.trim() || sourceText).then((content) => {
      if (!cancelled) setDisplayContent(content);
    });

    return () => {
      cancelled = true;
    };
  }, [questions, quesNumber]);

  const goBack = () => {
    router.push(backHref);
  };

  const playAudio = () => {
    if (audioRef.current) audioRef.current.play();
  };

  const changePlaybackRate = (rate: number) => {
    if (audioRef.current) {
      setIsAudoSlowSpeed(rate === 0.5);
      audioRef.current.playbackRate = rate;
    }
  };

  const getResult = () => {
    setResult(true);
  };

  const currentQ = questions[quesNumber];

  return (
    <div className="">
      <button className="ml-5 mt-5" onClick={goBack}>
        {"<返回"}
      </button>
      <div className="wrapper px-4 py-4">
        <div className="text-content">
          <div className="flex ml-3 mt-3">
            <div>原文:&nbsp;</div>
            <p>{currentQ?.originalText}</p>
          </div>
          <div
            key={`${quesNumber}-${displayContent}`}
            className="text-item mt-4 py-4 px-3 border-3 rounded-2xl border-green-200 relative text-lg leading-12 font-bold"
          >
            {displayContent}
            <div
              className="audio-icon text-2xl z-1000 h-[24px]"
              onClick={playAudio}
            >
              <IoVolumeMediumSharp className="float-right" />
            </div>
          </div>

          <audio ref={audioRef} muted={false} src={currentQ?.audioUrl}>
            <source type="audio/mpeg" />
          </audio>
        </div>
        <div className="setting-wrapper mt-4 flex flex-col">
          <div className="speed-setting flex mt-3">
            <div className="flex-1 text-center">
              <button
                className={classNames("leading-8 border-2 rounded-2xl", {
                  "px-5 border-green-200 text-green-200": !isAudoSlowSpeed,
                  "text-gray-400 border-transparent": isAudoSlowSpeed,
                })}
                onClick={() => changePlaybackRate(1)}
              >
                正常
              </button>
            </div>
            <div className="flex-1 text-center">
              <button
                className={classNames("leading-8 border-2 rounded-2xl", {
                  "px-5 border-green-200 text-green-200": isAudoSlowSpeed,
                  "text-gray-400 border-transparent": !isAudoSlowSpeed,
                })}
                onClick={() => changePlaybackRate(0.5)}
              >
                慢速
              </button>
            </div>
          </div>
        </div>
        <Game getResult={getResult} />

        {hasResult && questions.length > 1 && (
          <div className="question-setting flex-col flex mb-20">
            <div className="w-full">
              <button
                className="px-3 py-1 w-full"
                onClick={() => {
                  const num = Math.max(quesNumber - 1, 0);
                  setQuesNumber(num);
                  setCurrentQuestion(questions[num] || null);
                }}
              >
                上一题
              </button>
            </div>
            <div className="w-full">
              <button
                className="color-grey-200 leading-8 w-full border-green-200 border-2 rounded-2xl"
                onClick={() => {
                  const num = Math.min(
                    quesNumber + 1,
                    questions.length - 1
                  );
                  setQuesNumber(num);
                  setCurrentQuestion(questions[num] || null);
                }}
              >
                下一题
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
