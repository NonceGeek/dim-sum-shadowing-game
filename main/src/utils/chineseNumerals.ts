const CN_DIGITS = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"] as const;
const SECTION_UNITS = ["", "十", "百", "千"] as const;
const BIG_UNITS = ["", "万", "亿", "万亿"] as const;

function sectionToChinese(section: number): string {
  let str = "";
  let zeroPending = false;

  for (let i = 0; i < 4; i++) {
    const digit = section % 10;
    section = Math.floor(section / 10);

    if (digit === 0) {
      if (str) zeroPending = true;
      continue;
    }

    if (zeroPending) {
      str = "零" + str;
      zeroPending = false;
    }

    str = CN_DIGITS[digit] + SECTION_UNITS[i] + str;
  }

  return str;
}

/** 将非负整数转为中文数字（如 300 → 三百）。 */
export function integerToChinese(n: number): string {
  if (!Number.isFinite(n) || n < 0) return String(n);
  if (n === 0) return "零";

  let value = Math.floor(n);
  let result = "";
  let sectionIndex = 0;
  let needZero = false;

  while (value > 0) {
    const section = value % 10000;
    if (section !== 0) {
      let sectionStr = sectionToChinese(section);
      if (needZero && !sectionStr.startsWith("零")) {
        sectionStr = "零" + sectionStr;
      }
      result = sectionStr + BIG_UNITS[sectionIndex] + result;
      needZero = section < 1000;
    } else {
      needZero = result.length > 0;
    }
    value = Math.floor(value / 10000);
    sectionIndex++;
  }

  result = result.replace(/零+/g, "零").replace(/零$/g, "");
  // 10–19：十一、十二…（不说「一十」）
  result = result.replace(/^一十/, "十");
  return result;
}

/** 将文本中的阿拉伯数字串替换为中文数字。 */
export function convertArabicDigitsToChinese(text: string): string {
  return text.replace(/\d+/g, (match) => {
    const n = Number.parseInt(match, 10);
    if (Number.isNaN(n)) return match;
    return integerToChinese(n);
  });
}
