export type LeaderboardEntry = {
  id: string;
  createdAt: string;
  userName: string;
  sentence: string;
  audio: string;
  aiScore: number;
  expertScore: number;
  expertReview: string;
};

export type RankedLeaderboardEntry = LeaderboardEntry & {
  rank: number;
};

function parseLeaderboardLine(line: string): LeaderboardEntry | null {
  const parts = line.split(",");
  if (parts.length < 8) return null;

  const aiScore = Number(parts[5]);
  const expertScore = Number(parts[6]);
  if (Number.isNaN(aiScore) || Number.isNaN(expertScore)) return null;

  return {
    id: parts[0].trim(),
    createdAt: parts[1].trim(),
    userName: parts[2].trim(),
    sentence: parts[3].trim(),
    audio: parts[4].trim(),
    aiScore,
    expertScore,
    expertReview: parts.slice(7).join(",").trim(),
  };
}

export function parseLeaderboardCsv(text: string): LeaderboardEntry[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  return lines
    .slice(1)
    .map(parseLeaderboardLine)
    .filter((entry): entry is LeaderboardEntry => entry !== null);
}

export function rankLeaderboardEntries(entries: LeaderboardEntry[]): RankedLeaderboardEntry[] {
  const sorted = [...entries].sort((a, b) => {
    if (b.expertScore !== a.expertScore) return b.expertScore - a.expertScore;
    if (b.aiScore !== a.aiScore) return b.aiScore - a.aiScore;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return sorted.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

export function formatLeaderboardDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-HK", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function rankLabel(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}
