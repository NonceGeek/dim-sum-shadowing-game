"use client";
import { useState, useRef, useEffect } from "react";
import { IoVolumeMediumSharp } from "react-icons/io5";
import { useRouter } from "next/navigation";
import category from "@/data/category";
import Game from "@/components/Game";
import Footer from "@/components/Footer";
import { useQuestionStore } from "@/stores/questionStore";
import classNames from "classnames";

export default function FolllowPageDetail({ params }: any) {
  const router = useRouter();
  const [questions, setQuestions]: any = useState([]);
  const [hasReult, setResult]: any = useState(false);
  let [quesNumber, setQuesNumber] = useState(0);
  const [isAudoSlowSpeed, setIsAudoSlowSpeed] = useState(false);

  const audioRef: any = useRef(null);
  const { setCurrentQuestion } = useQuestionStore();
  const goBack = () => {
    router.push("/follow");
  };

  const playAudio = () => {
    const audio = document.querySelector("audio");
    if (audio) {
      audio.play();
    }
  };

  const changePlaybackRate = (rate: any): any => {
    if (audioRef.current) {
      setIsAudoSlowSpeed(rate === 0.5);
      audioRef.current.playbackRate = rate;
    }
  };

  const getResult = (result: any) => {
    setResult(!!result ? [] : result);
  };

  useEffect(() => {
    const ques: any = category[params.slug]?.questions || [];
    setQuestions(ques);
    setCurrentQuestion(ques[0] || []);
  }, []);

  return (
    <div className="">
      <button className="ml-5 mt-5" onClick={goBack}>
        {"<返回"}
      </button>
      <div className="wrapper px-4 py-4">
        <div className="text-content">
          <div className="flex ml-3 mt-3">
            <div>原文:&nbsp;</div>
            <p>{questions[quesNumber]?.originalText}</p>
          </div>
          <>
            <div
              key={questions[quesNumber]?.key}
              className="text-item mt-4 py-4 px-3 border-3 rounded-2xl border-green-200 relative text-lg leading-12 font-bold"
            >
              {questions[quesNumber]?.content}
              <div
                className="audio-icon text-2xl z-1000 h-[24px]"
                onClick={() => {
                  playAudio();
                }}
              >
                <IoVolumeMediumSharp className="float-right" />
              </div>
            </div>

            <audio
              ref={audioRef}
              muted={false}
              src={questions[quesNumber]?.audioUrl}
            >
              <source type="audio/mpeg"></source>
            </audio>
          </>
        </div>
        <div className="setting-wrapper mt-4 flex flex-col ">
          <div className="speed-setting flex mt-3">
            <div className="flex-1 text-center">
              <button
                className={classNames("leading-8 border-2 rounded-2xl", {
                  "px-5 border-green-200 text-green-200": !isAudoSlowSpeed,
                  "text-gray-400 border-transparent": isAudoSlowSpeed,
                })}
                onClick={() => {
                  changePlaybackRate(1);
                }}
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
                onClick={() => {
                  changePlaybackRate(0.5);
                }}
              >
                慢速
              </button>
            </div>
          </div>
        </div>
        <Game getResult={getResult} />

          <div className="question-setting flex-col flex mb-20">
            <div className="w-full">
              <button
                className="px-3 py-1 w-full"
                onClick={() => {
                  let quesNumber_ = quesNumber - 1;
                  const num = Math.min(
                    Math.max(quesNumber_, 0),
                    questions.length - 1
                  );
                  setQuesNumber(num);
                  setCurrentQuestion(questions[num] || []);
                }}
              >
                上一题
              </button>
            </div>

            <div className="w-full">
              <button
                className="color-grey-200 leading-8 w-full border-green-200 border-2 rounded-2xl"
                onClick={() => {
                  console.log("跟读中下一题");
                  let quesNumber_ = quesNumber + 1;
                  const num = Math.min(
                    Math.max(quesNumber_, 0),
                    questions.length - 1
                  );
                  setQuesNumber(num);
                  setCurrentQuestion(questions[num] || []);
                }}
              >
                下一题
              </button>
            </div>
          </div>
          
      </div>
      <Footer />
    </div>
  );
}
