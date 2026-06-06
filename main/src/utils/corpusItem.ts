type Block = Record<string, unknown>;

function findAudioBlock(blockList: Block[]): Block | undefined {
  return blockList.find((b) => {
    const type = b.type;
    return type === "audio" || type === "音频";
  });
}

function audioUrlFromBlock(block: Block | undefined): string {
  if (!block) return "";
  const url = block.url;
  return typeof url === "string" ? url : "";
}

export function transformCorpusItemToQuestion(item: Record<string, unknown>) {
  const data = (item.data as string) || "";
  const note = (item.note as Record<string, unknown>) || {};
  const context = (note.context as Record<string, unknown>) || {};
  const structuredNote = (item.structured_note as Record<string, unknown>) || {};
  const blocks = (structuredNote.data as unknown[])?.[0] as Record<string, unknown>;
  const blockList = (blocks?.blocks as Block[]) || [];
  const jyutping = (structuredNote.jyutping as string) || "";

  let audioUrl = (context.audio as string) || "";
  if (!audioUrl) {
    audioUrl = audioUrlFromBlock(findAudioBlock(blockList));
  }

  let originalText = (context.粤语文本 as string) || (note.meaning as string[])?.[0] || "";
  if (!originalText) {
    const defBlock = blockList.find((b) => b.type === "definition");
    originalText = (defBlock?.content as string) || "";
  }

  const jyutpingArr = jyutping ? jyutping.split(/\s+/) : [];
  let content = data;
  if (jyutpingArr.length > 0) {
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

export const CORPUS_API_BASE = "https://backend.aidimsum.com";

export async function fetchCorpusItem(uuid: string): Promise<Record<string, unknown>> {
  const url = `${CORPUS_API_BASE}/v2/corpus_item?unique_id=${encodeURIComponent(uuid)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data || Object.keys(data).length === 0) {
    throw new Error("未找到该语料");
  }
  return data;
}
