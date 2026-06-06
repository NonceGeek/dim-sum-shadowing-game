import type { ReactNode } from "react";
import { isValidElement } from "react";

/** Flatten react-markdown heading children to plain text. */
export function headingText(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(headingText).join("");
  if (isValidElement<{ children?: ReactNode }>(children)) {
    return headingText(children.props.children);
  }
  return "";
}

/** Build URL fragment id from heading text (prefers section numbers like 1.1). */
export function headingAnchorId(text: string): string {
  const trimmed = text.trim();
  const sectionMatch = trimmed.match(/^(\d+(?:\.\d+)*)/);
  if (sectionMatch) return sectionMatch[1];

  const slug = trimmed
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fff-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "section";
}
