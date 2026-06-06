import React from "react";

interface ScoreDisplayProps {
  score: number;
  feedback: string;
}

const ScoreDisplay = ({ score, feedback }: ScoreDisplayProps) => {
  return (
    <div className="text-center pt-12 pb-4">
      <div className="text-4xl font-bold rounded-2xl border-3 border-green-200 w-22 text-center py-3 mx-auto my-0">{score}</div>
      <p className="mt-3 text-green-200">{feedback}</p>
    </div>
  );
};

export default ScoreDisplay;
