"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { IoVolumeMediumSharp } from "react-icons/io5";
import { Alert, Table } from "antd";
import { useRouter } from "next/navigation";
import classNames from "classnames";
import DOMPurify from "dompurify";
import category from "@/data/category";
import categoryGfxm from "@/data/category_gfxm";
import Game, { GameHandle, QuestionResult } from "@/components/Game";
import Footer from "@/components/Footer";
import { useQuestionStore } from "@/stores/questionStore";
import CelebrationEffect from "@/components/CelebrationEffect";

export default function FolllowPageDetail({ params }: any) {
  const router = useRouter();
  const [questions, setQuestions]: any = useState([]);
  const [hasReult, setResult]: any = useState(false);
  const [correctInfo, setCorrectInfo]: any = useState(false);

  let [quesNumber, setQuesNumber] = useState(0);
  const [userSelectedQuizAns, setUserSelectedQuizAns]: any = useState([]);
  const [results, setResults] = useState<Record<number, QuestionResult>>({});
  const [showResults, setShowResults] = useState(false);

  const audioRef: any = useRef(null);
  const gameRef = useRef<GameHandle>(null);
  const { setCurrentQuestion } = useQuestionStore();
  const goBack = () => {
    router.push("/game");
  };

  const sanitizeHtml = (html: any) => {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        "b",
        "i",
        "u",
        "em",
        "strong",
        "a",
        "p",
        "br",
        "ul",
        "ol",
        "li",
        "div",
      ],
      ALLOWED_ATTR: ["href", "title"],
      FORBID_TAGS: ["script", "style", "iframe", "frame", "object", "embed"],
      FORBID_ATTR: ["onclick", "onload", "onerror"],
    });
  };

  const playAudio = () => {
    const audio = document.querySelector("audio");
    if (audio) {
      audio.play();
    }
  };

  const getResult = (result: any) => {
    setResult(!!result ? [] : result);
  };

  useEffect(() => {
    const categoryItem: { questions?: unknown[] } | undefined =
      params.slug === "gfxm1"
        ? categoryGfxm.gfxm1
        : (category as unknown as Record<string, { questions?: unknown[] }>)[
            params.slug
          ];
    const ques: any = categoryItem?.questions || [];
    setQuestions(ques);
    setCurrentQuestion(ques[0] || []);
  }, [params.slug]);

  useEffect(() => {
    const answers = questions[quesNumber]?.yueQuizAnswer;
    if (answers && answers.length !== 0) {
      if (answers.every((item: any) => userSelectedQuizAns.includes(item))) {
        setCorrectInfo(true);
      }
    }
  }, [userSelectedQuizAns]);

  const resultsColumns = [
    { title: "题目", dataIndex: "index", key: "index", width: 60 },
    { title: "识别结果", dataIndex: "transcript", key: "transcript" },
    { title: "粤语原文", dataIndex: "yueText", key: "yueText" },
    { title: "分数", dataIndex: "score", key: "score", width: 80 },
    { title: "评语", dataIndex: "feedback", key: "feedback" },
  ];

  const resultsData = questions.map((q: any, i: number) => ({
    key: i,
    index: i + 1,
    transcript: results[i]?.transcript ?? "—",
    yueText: results[i]?.yueText ?? q?.yueText ?? "—",
    score: results[i]?.score ?? "—",
    feedback: results[i]?.feedback ?? "—",
  }));

  return (
    <div className="">
      {showResults && (
        <div className="fixed inset-0 z-50 overflow-auto bg-black/80 flex items-start justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-4xl w-full my-8">
            <h2 className="text-xl font-bold text-black mb-4">游戏结果</h2>
            <Table
              columns={resultsColumns}
              dataSource={resultsData}
              pagination={false}
              size="small"
              className="[&_.ant-table]:text-black [&_.ant-table-thead_th]:bg-neutral-200 [&_.ant-table-thead_th]:text-black [&_.ant-table-tbody_td]:text-black [&_.ant-table]:border-neutral-600"
            />
            <button
              className="mt-4 px-4 py-2 border border-black text-black rounded-xl"
              onClick={() => setShowResults(false)}
            >
              返回
            </button>
          </div>
        </div>
      )}
      {correctInfo && (
        <CelebrationEffect type={"confetti"} message={"答对啦"} />
      )}
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
              <div
                className="game-quiz-warpper"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(questions[quesNumber]?.yueQuizText),
                }}
              ></div>
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
              key={questions[quesNumber]?.audioUrl}
            >
              <source
                src={questions[quesNumber]?.audioUrl}
                type="audio/mpeg"
              ></source>
            </audio>

            <div className="flex justify-center items-center mt-4">
              {questions[quesNumber]?.yueQuiz ? (
                questions[quesNumber]?.yueQuiz.map((quiz: any) => {
                  return (
                    <div
                      onClick={() => {
                        const answers = questions[quesNumber]?.yueQuizAnswer;
                        const result = answers.find(
                          (item: any) => item === quiz
                        );
                        if (result) {
                          setUserSelectedQuizAns([
                            ...userSelectedQuizAns,
                            result,
                          ]);
                        } else {
                          setCorrectInfo(false);
                        }
                      }}
                      key={quiz}
                      className={classNames(
                        "text-center border-2 p-3 m-2 text-xl rounded-lg cursor-pointer",
                        {
                          "text-green-200 border-green-200":
                            userSelectedQuizAns.includes(quiz),
                          "text-gray-200 border-gray-200":
                            !userSelectedQuizAns.includes(quiz),
                        }
                      )}
                    >
                      {quiz}
                    </div>
                  );
                })
              ) : (
                <></>
              )}
            </div>
          </>
        </div>
        <Game
          key={quesNumber}
          ref={gameRef}
          getResult={getResult}
          onResult={(r) => setResults((prev) => ({ ...prev, [quesNumber]: r }))}
        />
        {hasReult ? (
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
                  gameRef.current?.reset();
                }}
              >
                上一题
              </button>
            </div>

            <div className="w-full">
              <button
                className="color-grey-200 leading-8 w-full border-green-200 border-2 rounded-2xl"
                onClick={() => {
                  const isLastQuestion =
                    quesNumber === questions.length - 1;
                  if (isLastQuestion) {
                    setShowResults(true);
                    return;
                  }
                  let quesNumber_ = quesNumber + 1;
                  const num = Math.min(
                    Math.max(quesNumber_, 0),
                    questions.length - 1
                  );
                  setQuesNumber(num);
                  setCurrentQuestion(questions[num] || []);
                  gameRef.current?.reset();
                }}
              >
                {quesNumber === questions.length - 1 ? "查看结果" : "下一题"}
              </button>
            </div>
          </div>
        ) : (
          <></>
        )}
      </div>
      <Footer />
    </div>
  );
}
