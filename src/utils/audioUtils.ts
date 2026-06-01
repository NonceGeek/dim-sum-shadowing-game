"use client";
// 模拟语音识别评分
export const analyzeRecording = (duration: number) => {
  // 基于录音时长生成分数
  let calculatedScore = Math.min(100, Math.floor(duration * 8));

  // 添加随机波动使分数更自然
  calculatedScore = Math.min(
    100,
    calculatedScore + Math.floor(Math.random() * 10) - 5
  );

  // 确保分数在合理范围内
  calculatedScore = Math.max(40, calculatedScore);

  // 生成反馈
  let feedbackText = "";
  if (calculatedScore >= 90) {
    feedbackText = "优秀！发音清晰，内容完整，表达流畅。继续保持！";
  } else if (calculatedScore >= 80) {
    feedbackText = "良好！表达清晰，但有些地方可以更流畅。尝试放慢语速。";
  } else if (calculatedScore >= 70) {
    feedbackText = "中等！基本表达清楚，但需要提升流利度和词汇量。";
  } else if (calculatedScore >= 60) {
    feedbackText = "及格！需要加强发音和内容组织能力。建议多练习。";
  } else {
    feedbackText = "需要更多练习，注意发音准确性和表达清晰度。";
  }

  return {
    score: calculatedScore,
    feedback: feedbackText,
  };
};

// 格式化时间 (秒 -> MM:SS)
export const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
};
