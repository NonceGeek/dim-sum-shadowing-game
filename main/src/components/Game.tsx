"use client";
import { useState, useRef, forwardRef, useImperativeHandle } from "react";
import WaveRecorder, { WaveRecorderHandle } from "@/components/WaveRecorder";
import ScoreDisplay from "@/components/ScoreDisplay";
import CelebrationEffect from "@/components/CelebrationEffect";

export interface GameHandle {
  reset: () => void;
}

export interface QuestionResult {
  transcript: string;
  yueText: string;
  score: number;
  feedback: string;
}

const Game = forwardRef<
  GameHandle,
  { getResult: any; onResult?: (result: QuestionResult) => void }
>(({ getResult, onResult }, ref) => {
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [showScore, setShowScore] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [yueText, setYueText] = useState("");

  const recorderRef = useRef<WaveRecorderHandle>(null);

  // 处理录音完成，记录识别结果、粤语原文和得分
  const handleRecordingComplete = (
    score: number,
    feedback: string,
    transcript: string,
    yueText: string
  ) => {
    setScore(score);
    setFeedback(feedback);
    setTranscript(transcript);
    setYueText(yueText);
    setShowScore(true);
    getResult(score);
    onResult?.({ transcript, yueText, score, feedback });
  };

  // 重置所有状态（供父组件通过 ref 调用）
  const resetAll = () => {
    setScore(0);
    setFeedback("");
    setTranscript("");
    setYueText("");
    setShowScore(false);
    recorderRef.current?.reset();
  };

  useImperativeHandle(ref, () => ({ reset: resetAll }));

  return (
    <main className="container mx-auto py-8 max-w-4xl">
      {score > 70 && (
        <CelebrationEffect type={"confetti"} message={"发音很棒"} />
      )}
      <WaveRecorder
        ref={recorderRef}
        onRecordingComplete={handleRecordingComplete}
        onReset={resetAll}
      />
      {showScore && <ScoreDisplay score={score} feedback={feedback} />}
    </main>
  );
});

Game.displayName = "Game";

export default Game;
